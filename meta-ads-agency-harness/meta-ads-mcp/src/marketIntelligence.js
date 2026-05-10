/**
 * marketIntelligence.js — Market Intelligence Analysis Engine
 *
 * Pure functions only. No network calls, no imports from metaClient or config.
 * All exports are deterministic given the same inputs.
 */

import { inferHookType } from "./intelligence.js";

// ---------------------------------------------------------------------------
// Run Duration
// ---------------------------------------------------------------------------

/**
 * Compute run duration in days from start date to stop date or reference date,
 * whichever is earlier.
 *
 * @param {string|Date|null} startDate
 * @param {string|Date|null} stopDate - null means ad is still active
 * @param {Date} referenceDate - "today" for the computation
 * @returns {number|null} non-negative days, or null if startDate is invalid
 */
export function computeRunDuration(startDate, stopDate, referenceDate) {
  if (!startDate) return null;

  const ref = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  const start = new Date(startDate);

  if (isNaN(start.getTime())) return null;

  // Use the earlier of stopDate and referenceDate as the end point
  let end = ref;
  if (stopDate) {
    const stop = new Date(stopDate);
    if (!isNaN(stop.getTime()) && stop < ref) {
      end = stop;
    }
  }

  const diffMs = end.getTime() - start.getTime();
  // Non-negative: if start is after end, return 0
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

// ---------------------------------------------------------------------------
// Impression Range Scoring
// ---------------------------------------------------------------------------

/**
 * Map an impression range object to a 0–5 ordinal score.
 *
 * @param {{ lower_bound: string|number, upper_bound: string|number }|null} impressions
 * @returns {number} 0–5
 */
export function scoreImpressionRange(impressions) {
  if (!impressions || impressions.lower_bound == null) return 0;

  const lower = Number(impressions.lower_bound);
  if (!Number.isFinite(lower)) return 0;

  if (lower >= 100000) return 5;
  if (lower >= 50000) return 4;
  if (lower >= 10000) return 3;
  if (lower >= 5000) return 2;
  if (lower >= 1000) return 1;
  return 0;
}

// ---------------------------------------------------------------------------
// Offer Signal Inference
// ---------------------------------------------------------------------------

const OFFER_SIGNAL_PATTERNS = [
  { signal: "discount", keywords: ["% off", "save", "discount", "sale", "deal", "promo"] },
  { signal: "free_trial", keywords: ["free trial", "try free", "free for", "no cost"] },
  { signal: "bundle", keywords: ["bundle", "pack", "kit", "combo", "set of"] },
  { signal: "guarantee", keywords: ["guarantee", "money back", "risk free", "risk-free", "refund"] },
  { signal: "scarcity", keywords: ["limited", "only", "ends soon", "last chance", "today only"] }
];

/**
 * Infer offer signal from ad body text using keyword pattern matching.
 *
 * @param {string|null} text
 * @returns {string} one of: discount, free_trial, bundle, guarantee, scarcity, none_detected
 */
export function inferOfferSignal(text) {
  if (!text || typeof text !== "string") return "none_detected";
  const lower = text.toLowerCase();
  for (const { signal, keywords } of OFFER_SIGNAL_PATTERNS) {
    if (keywords.some((kw) => lower.includes(kw))) return signal;
  }
  return "none_detected";
}

// ---------------------------------------------------------------------------
// Ad Enrichment
// ---------------------------------------------------------------------------

/**
 * Enrich a single raw Ad Library ad with computed signals.
 * All signal fields are always present (never undefined); absent values are null.
 *
 * @param {object} rawAd
 * @param {Date} referenceDate
 * @returns {object} EnrichedAd
 */
export function enrichAd(rawAd, referenceDate) {
  const ad = rawAd ?? {};
  const ref = referenceDate instanceof Date ? referenceDate : new Date();

  const primaryText = Array.isArray(ad.ad_creative_bodies) && ad.ad_creative_bodies.length > 0
    ? (ad.ad_creative_bodies[0] ?? null)
    : null;

  const headline = Array.isArray(ad.ad_creative_link_titles) && ad.ad_creative_link_titles.length > 0
    ? (ad.ad_creative_link_titles[0] ?? null)
    : null;

  const runDuration = computeRunDuration(
    ad.ad_delivery_start_time ?? null,
    ad.ad_delivery_stop_time ?? null,
    ref
  );

  const impressionRange = ad.impressions
    ? formatImpressionRange(ad.impressions)
    : null;

  const platforms = Array.isArray(ad.publisher_platforms) ? ad.publisher_platforms : [];

  // Hook signal: infer from primary text (reuse inferHookType from intelligence.js)
  const hookSignal = inferHookType(primaryText ?? "");

  // Format signal: normalise media type
  const formatSignal = normaliseFormat(ad.ad_creative_media_type ?? null);

  // Offer signal: infer from primary text
  const offerSignal = inferOfferSignal(primaryText);

  // CTA signal
  const ctaSignal = ad.call_to_action_type ?? null;

  const impressionScore = scoreImpressionRange(ad.impressions ?? null);
  const compositeScore = computeCompositeScore(runDuration, impressionScore);

  return {
    id: ad.id ?? null,
    page_name: ad.page_name ?? null,
    page_id: ad.page_id ?? null,
    ad_snapshot_url: ad.ad_snapshot_url ?? null,
    primary_text: primaryText,
    headline: headline,
    run_duration_days: runDuration,
    impression_range: impressionRange,
    publisher_platforms: platforms,
    hook_signal: hookSignal,
    format_signal: formatSignal,
    offer_signal: offerSignal,
    cta_signal: ctaSignal,
    performance_tier: "unclassified", // set by classifyTiers
    composite_score: compositeScore
  };
}

function formatImpressionRange(impressions) {
  if (!impressions) return null;
  const lower = impressions.lower_bound;
  const upper = impressions.upper_bound;
  if (lower == null && upper == null) return null;
  return `${lower ?? "?"}-${upper ?? "?"}`;
}

function normaliseFormat(mediaType) {
  if (!mediaType) return null;
  const t = mediaType.toLowerCase();
  if (t === "video") return "video";
  if (t === "image") return "image";
  if (t === "dco") return "carousel"; // Dynamic Creative Optimisation often carousel-like
  if (t === "carousel") return "carousel";
  return mediaType.toLowerCase();
}

function computeCompositeScore(runDurationDays, impressionScore) {
  const duration = runDurationDays ?? 0;
  return (duration / 30) + impressionScore * 2;
}

// ---------------------------------------------------------------------------
// Frequency Maps
// ---------------------------------------------------------------------------

/**
 * Compute a frequency map for a signal field across an array of ads.
 *
 * @param {object[]} ads
 * @param {string} field
 * @returns {Record<string, number>}
 */
export function computeFrequencies(ads, field) {
  const freq = {};
  for (const ad of ads) {
    const value = String(ad[field] ?? "null");
    freq[value] = (freq[value] ?? 0) + 1;
  }
  return freq;
}

// ---------------------------------------------------------------------------
// Tier Classification
// ---------------------------------------------------------------------------

/**
 * Classify enriched ads into top/low/unclassified tiers using tercile logic.
 * Returns { top: EnrichedAd[], low: EnrichedAd[], unclassified: EnrichedAd[] }.
 * All ads are unclassified when fewer than 3 are present.
 *
 * @param {object[]} enrichedAds
 * @returns {{ top: object[], low: object[], unclassified: object[] }}
 */
export function classifyTiers(enrichedAds) {
  if (!Array.isArray(enrichedAds) || enrichedAds.length < 3) {
    return {
      top: [],
      low: [],
      unclassified: enrichedAds.map((ad) => ({ ...ad, performance_tier: "unclassified" }))
    };
  }

  // Sort by composite score ascending to find tercile boundaries
  const sorted = [...enrichedAds].sort((a, b) => a.composite_score - b.composite_score);
  const n = sorted.length;
  const tercileSize = n / 3;

  // Tercile boundaries (indices)
  const lowCutoff = Math.floor(tercileSize);
  const highCutoff = Math.floor(tercileSize * 2);

  const top = [];
  const low = [];
  const unclassified = [];

  for (let i = 0; i < sorted.length; i++) {
    const ad = sorted[i];
    let tier;
    if (i < lowCutoff) {
      tier = "low";
    } else if (i >= highCutoff) {
      tier = "top";
    } else {
      tier = "unclassified";
    }
    const tiered = { ...ad, performance_tier: tier };
    if (tier === "top") top.push(tiered);
    else if (tier === "low") low.push(tiered);
    else unclassified.push(tiered);
  }

  return { top, low, unclassified };
}

// ---------------------------------------------------------------------------
// Intelligence Report
// ---------------------------------------------------------------------------

/**
 * Compute average run duration for an array of enriched ads.
 * Returns null when the array is empty or all durations are null.
 */
function avgRunDuration(ads) {
  const values = ads.map((a) => a.run_duration_days).filter((v) => v !== null && v !== undefined);
  if (values.length === 0) return null;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/**
 * Build tier pattern analysis for a set of ads.
 */
function buildTierPatterns(ads) {
  return {
    hook_frequencies: computeFrequencies(ads, "hook_signal"),
    format_frequencies: computeFrequencies(ads, "format_signal"),
    offer_frequencies: computeFrequencies(ads, "offer_signal"),
    cta_frequencies: computeFrequencies(ads, "cta_signal"),
    avg_run_duration_days: avgRunDuration(ads)
  };
}

/**
 * Pick the dominant (most frequent) key from a frequency map.
 * Returns null when the map is empty.
 */
function dominantKey(freqMap) {
  const entries = Object.entries(freqMap);
  if (entries.length === 0) return null;
  return entries.reduce((best, curr) => (curr[1] > best[1] ? curr : best))[0];
}

/**
 * Build the workflow_context hints from top performer patterns.
 *
 * @param {object} topPatterns - TierPatterns for top performers
 * @param {string|null} brandContext
 * @returns {{ creative_brief_hint: string, offer_strategy_hint: string }}
 */
function buildWorkflowContext(topPatterns, brandContext) {
  const dominantHook = dominantKey(topPatterns.hook_frequencies);
  const dominantFormat = dominantKey(topPatterns.format_frequencies);
  const dominantOffer = dominantKey(topPatterns.offer_frequencies);

  const hookLabel = dominantHook && dominantHook !== "null" ? dominantHook.replace(/_/g, " ") : null;
  const formatLabel = dominantFormat && dominantFormat !== "null" ? dominantFormat : null;
  const offerLabel = dominantOffer && dominantOffer !== "null" ? dominantOffer.replace(/_/g, " ") : null;

  let creativeBriefHint;
  if (hookLabel && formatLabel) {
    creativeBriefHint = `Top performers favour a "${hookLabel}" hook delivered as ${formatLabel} creative.`;
  } else if (hookLabel) {
    creativeBriefHint = `Top performers favour a "${hookLabel}" hook.`;
  } else if (formatLabel) {
    creativeBriefHint = `Top performers favour ${formatLabel} creative format.`;
  } else {
    creativeBriefHint = "No dominant hook or format pattern detected among top performers.";
  }

  if (brandContext) {
    creativeBriefHint += ` Brand context: ${brandContext}`;
  }

  const offerStrategyHint = offerLabel && offerLabel !== "none detected"
    ? `Top performers most commonly use a "${offerLabel}" offer signal.`
    : "No dominant offer signal detected among top performers.";

  return { creative_brief_hint: creativeBriefHint, offer_strategy_hint: offerStrategyHint };
}

/**
 * Assemble the full Intelligence_Report from enriched ads.
 *
 * @param {object[]} enrichedAds - Already enriched (but not yet tiered) ads
 * @param {string} query
 * @param {string} country
 * @param {string|null} brandContext
 * @returns {object} Intelligence_Report
 */
export function buildIntelligenceReport(enrichedAds, query, country, brandContext) {
  const ads = Array.isArray(enrichedAds) ? enrichedAds : [];

  if (ads.length === 0) {
    const emptyPatterns = {
      hook_frequencies: {},
      format_frequencies: {},
      offer_frequencies: {},
      cta_frequencies: {},
      avg_run_duration_days: null
    };
    return {
      query: query ?? "",
      country: country ?? "US",
      total_ads_analysed: 0,
      top_performers: [],
      low_performers: [],
      unclassified: [],
      pattern_analysis: {
        top_performer_patterns: emptyPatterns,
        low_performer_patterns: emptyPatterns
      },
      workflow_context: {
        creative_brief_hint: "No competitor data found. Consider broadening your search query or country.",
        offer_strategy_hint: "No competitor data found."
      }
    };
  }

  const { top, low, unclassified } = classifyTiers(ads);

  const topPatterns = buildTierPatterns(top);
  const lowPatterns = buildTierPatterns(low);
  const workflowContext = buildWorkflowContext(topPatterns, brandContext ?? null);

  return {
    query: query ?? "",
    country: country ?? "US",
    total_ads_analysed: ads.length,
    top_performers: top,
    low_performers: low,
    unclassified,
    pattern_analysis: {
      top_performer_patterns: topPatterns,
      low_performer_patterns: lowPatterns
    },
    workflow_context: workflowContext
  };
}
