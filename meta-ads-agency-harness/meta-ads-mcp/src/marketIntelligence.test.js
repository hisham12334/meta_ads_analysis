/**
 * marketIntelligence.test.js — Market Intelligence Analysis Engine tests
 *
 * Covers unit tests and property-based tests for all pure functions in
 * marketIntelligence.js.
 */

import fc from "fast-check";
import {
  computeRunDuration,
  scoreImpressionRange,
  inferOfferSignal,
  enrichAd,
  computeFrequencies,
  classifyTiers,
  buildIntelligenceReport
} from "./marketIntelligence.js";

// ---------------------------------------------------------------------------
// Arbitraries (generators for property-based tests)
// ---------------------------------------------------------------------------

/** Generate a random ISO date string between 2020-01-01 and 2026-12-31 */
const arbitraryDateString = () =>
  fc.date({ min: new Date("2020-01-01"), max: new Date("2026-12-31") })
    .filter((d) => !isNaN(d.getTime()))
    .map((d) => d.toISOString());

/** Generate a raw ad record with random missing/null fields */
const arbitraryRawAd = () =>
  fc.record({
    id: fc.oneof(fc.string(), fc.constant(null), fc.constant(undefined)),
    ad_creative_bodies: fc.oneof(
      fc.array(fc.string(), { minLength: 0, maxLength: 3 }),
      fc.constant(null),
      fc.constant(undefined)
    ),
    ad_creative_link_titles: fc.oneof(
      fc.array(fc.string(), { minLength: 0, maxLength: 3 }),
      fc.constant(null),
      fc.constant(undefined)
    ),
    ad_delivery_start_time: fc.oneof(arbitraryDateString(), fc.constant(null), fc.constant(undefined)),
    ad_delivery_stop_time: fc.oneof(arbitraryDateString(), fc.constant(null), fc.constant(undefined)),
    impressions: fc.oneof(
      fc.record({
        lower_bound: fc.oneof(fc.nat({ max: 200000 }).map(String), fc.constant(null)),
        upper_bound: fc.oneof(fc.nat({ max: 500000 }).map(String), fc.constant(null))
      }),
      fc.constant(null),
      fc.constant(undefined)
    ),
    publisher_platforms: fc.oneof(
      fc.array(fc.constantFrom("facebook", "instagram", "messenger", "audience_network"), { minLength: 0, maxLength: 4 }),
      fc.constant(null),
      fc.constant(undefined)
    ),
    ad_creative_media_type: fc.oneof(
      fc.constantFrom("IMAGE", "VIDEO", "DCO", "CAROUSEL", null),
      fc.constant(undefined)
    ),
    page_name: fc.oneof(fc.string(), fc.constant(null), fc.constant(undefined)),
    page_id: fc.oneof(fc.string(), fc.constant(null), fc.constant(undefined)),
    ad_snapshot_url: fc.oneof(fc.string(), fc.constant(null), fc.constant(undefined)),
    call_to_action_type: fc.oneof(
      fc.constantFrom("SHOP_NOW", "LEARN_MORE", "SIGN_UP", "GET_OFFER", null),
      fc.constant(undefined)
    )
  });

/** Generate a minimal enriched ad (already processed) */
const arbitraryEnrichedAd = () =>
  fc.record({
    id: fc.string(),
    page_name: fc.oneof(fc.string(), fc.constant(null)),
    page_id: fc.oneof(fc.string(), fc.constant(null)),
    ad_snapshot_url: fc.oneof(fc.string(), fc.constant(null)),
    primary_text: fc.oneof(fc.string(), fc.constant(null)),
    headline: fc.oneof(fc.string(), fc.constant(null)),
    run_duration_days: fc.oneof(fc.nat({ max: 730 }), fc.constant(null)),
    impression_range: fc.oneof(fc.string(), fc.constant(null)),
    publisher_platforms: fc.array(fc.string(), { minLength: 0, maxLength: 4 }),
    hook_signal: fc.constantFrom("question", "stat_hook", "problem_agitate", "testimonial", "ugc", "demo", "founder_story", "unknown"),
    format_signal: fc.oneof(fc.constantFrom("image", "video", "carousel"), fc.constant(null)),
    offer_signal: fc.constantFrom("discount", "free_trial", "bundle", "guarantee", "scarcity", "none_detected"),
    cta_signal: fc.oneof(fc.constantFrom("SHOP_NOW", "LEARN_MORE", "SIGN_UP"), fc.constant(null)),
    performance_tier: fc.constantFrom("top", "low", "unclassified"),
    composite_score: fc.float({ min: 0, max: 100, noNaN: true })
  });

// ---------------------------------------------------------------------------
// computeRunDuration — unit tests
// ---------------------------------------------------------------------------

describe("computeRunDuration", () => {
  const REF = new Date("2026-05-09");

  test("returns 0 when start equals reference date", () => {
    expect(computeRunDuration("2026-05-09", null, REF)).toBe(0);
  });

  test("returns correct days for a known range", () => {
    expect(computeRunDuration("2026-04-09", null, REF)).toBe(30);
  });

  test("uses stop date when it is before reference date", () => {
    // stop is 10 days after start, ref is 30 days after start
    expect(computeRunDuration("2026-04-09", "2026-04-19", REF)).toBe(10);
  });

  test("ignores stop date when it is after reference date", () => {
    // stop is in the future relative to ref
    expect(computeRunDuration("2026-04-09", "2026-06-01", REF)).toBe(30);
  });

  test("returns null for null startDate", () => {
    expect(computeRunDuration(null, null, REF)).toBeNull();
  });

  test("returns null for invalid startDate string", () => {
    expect(computeRunDuration("not-a-date", null, REF)).toBeNull();
  });

  test("returns 0 when start is after reference (clamps to non-negative)", () => {
    expect(computeRunDuration("2026-12-01", null, REF)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeRunDuration — property-based tests
// ---------------------------------------------------------------------------

describe("computeRunDuration — property tests", () => {
  // Feature: market-intelligence-tool, Property 1: run duration is non-negative
  test("Property 1: run duration is non-negative when start ≤ reference", () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date("2020-01-01"), max: new Date("2026-12-31") }),
        fc.date({ min: new Date("2020-01-01"), max: new Date("2026-12-31") }),
        (d1, d2) => {
          // Guard against NaN dates that fc.date can occasionally produce
          if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return true;
          const start = d1 <= d2 ? d1 : d2;
          const ref = d1 <= d2 ? d2 : d1;
          const result = computeRunDuration(start.toISOString(), null, ref);
          return result === null || result >= 0;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// scoreImpressionRange — unit tests
// ---------------------------------------------------------------------------

describe("scoreImpressionRange", () => {
  test("returns 0 for null", () => {
    expect(scoreImpressionRange(null)).toBe(0);
  });

  test("returns 0 for undefined", () => {
    expect(scoreImpressionRange(undefined)).toBe(0);
  });

  test("returns 0 for lower_bound null", () => {
    expect(scoreImpressionRange({ lower_bound: null, upper_bound: "5000" })).toBe(0);
  });

  test("returns 0 for lower_bound < 1000", () => {
    expect(scoreImpressionRange({ lower_bound: "500", upper_bound: "999" })).toBe(0);
  });

  test("returns 1 for lower_bound 1000–4999", () => {
    expect(scoreImpressionRange({ lower_bound: "1000", upper_bound: "4999" })).toBe(1);
  });

  test("returns 2 for lower_bound 5000–9999", () => {
    expect(scoreImpressionRange({ lower_bound: "5000", upper_bound: "9999" })).toBe(2);
  });

  test("returns 3 for lower_bound 10000–49999", () => {
    expect(scoreImpressionRange({ lower_bound: "10000", upper_bound: "49999" })).toBe(3);
  });

  test("returns 4 for lower_bound 50000–99999", () => {
    expect(scoreImpressionRange({ lower_bound: "50000", upper_bound: "99999" })).toBe(4);
  });

  test("returns 5 for lower_bound ≥ 100000", () => {
    expect(scoreImpressionRange({ lower_bound: "100000", upper_bound: "999999" })).toBe(5);
  });

  test("score is always 0–5", () => {
    const inputs = [
      null, { lower_bound: "0" }, { lower_bound: "999" }, { lower_bound: "1000" },
      { lower_bound: "5000" }, { lower_bound: "10000" }, { lower_bound: "50000" },
      { lower_bound: "100000" }, { lower_bound: "999999" }
    ];
    for (const input of inputs) {
      const score = scoreImpressionRange(input);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(5);
    }
  });
});

// ---------------------------------------------------------------------------
// inferOfferSignal — unit tests
// ---------------------------------------------------------------------------

describe("inferOfferSignal", () => {
  test("returns none_detected for null", () => {
    expect(inferOfferSignal(null)).toBe("none_detected");
  });

  test("returns none_detected for empty string", () => {
    expect(inferOfferSignal("")).toBe("none_detected");
  });

  test("detects discount from '% off'", () => {
    expect(inferOfferSignal("Get 20% off today")).toBe("discount");
  });

  test("detects free_trial from 'free trial'", () => {
    expect(inferOfferSignal("Start your free trial now")).toBe("free_trial");
  });

  test("detects bundle from 'bundle'", () => {
    expect(inferOfferSignal("Get the bundle pack today")).toBe("bundle");
  });

  test("detects guarantee from 'money back'", () => {
    expect(inferOfferSignal("100% money back guarantee")).toBe("guarantee");
  });

  test("detects scarcity from 'limited'", () => {
    expect(inferOfferSignal("Limited time offer")).toBe("scarcity");
  });

  test("returns first match when multiple signals present (discount before free_trial)", () => {
    // 'save' (discount) appears before 'free trial' in pattern order
    expect(inferOfferSignal("save big with our free trial")).toBe("discount");
  });

  test("is case-insensitive", () => {
    expect(inferOfferSignal("SAVE 50% TODAY")).toBe("discount");
  });
});

// ---------------------------------------------------------------------------
// enrichAd — unit tests
// ---------------------------------------------------------------------------

describe("enrichAd", () => {
  const REF = new Date("2026-05-09");

  test("all signal fields are present for a fully null raw record", () => {
    const enriched = enrichAd(null, REF);
    const signalFields = [
      "run_duration_days", "impression_range", "hook_signal",
      "format_signal", "offer_signal", "cta_signal", "performance_tier",
      "composite_score"
    ];
    for (const field of signalFields) {
      expect(field in enriched).toBe(true);
    }
  });

  test("all signal fields are present for an empty object", () => {
    const enriched = enrichAd({}, REF);
    const signalFields = [
      "run_duration_days", "impression_range", "hook_signal",
      "format_signal", "offer_signal", "cta_signal", "performance_tier",
      "composite_score"
    ];
    for (const field of signalFields) {
      expect(field in enriched).toBe(true);
    }
  });

  test("extracts primary_text from first body variant", () => {
    const enriched = enrichAd({ ad_creative_bodies: ["Hello world", "Alt text"] }, REF);
    expect(enriched.primary_text).toBe("Hello world");
  });

  test("primary_text is null when bodies array is empty", () => {
    const enriched = enrichAd({ ad_creative_bodies: [] }, REF);
    expect(enriched.primary_text).toBeNull();
  });

  test("format_signal is 'video' for VIDEO media type", () => {
    const enriched = enrichAd({ ad_creative_media_type: "VIDEO" }, REF);
    expect(enriched.format_signal).toBe("video");
  });

  test("format_signal is 'image' for IMAGE media type", () => {
    const enriched = enrichAd({ ad_creative_media_type: "IMAGE" }, REF);
    expect(enriched.format_signal).toBe("image");
  });

  test("format_signal is 'carousel' for DCO media type", () => {
    const enriched = enrichAd({ ad_creative_media_type: "DCO" }, REF);
    expect(enriched.format_signal).toBe("carousel");
  });

  test("format_signal is null when media type is null", () => {
    const enriched = enrichAd({ ad_creative_media_type: null }, REF);
    expect(enriched.format_signal).toBeNull();
  });

  test("performance_tier defaults to unclassified", () => {
    const enriched = enrichAd({}, REF);
    expect(enriched.performance_tier).toBe("unclassified");
  });

  test("composite_score is a finite number", () => {
    const enriched = enrichAd({
      ad_delivery_start_time: "2026-04-09",
      impressions: { lower_bound: "10000", upper_bound: "49999" }
    }, REF);
    expect(Number.isFinite(enriched.composite_score)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// enrichAd — property-based tests
// ---------------------------------------------------------------------------

describe("enrichAd — property tests", () => {
  // Feature: market-intelligence-tool, Property 2: enriched ad signal fields are never undefined
  test("Property 2: enriched ad signal fields are never undefined", () => {
    fc.assert(
      fc.property(
        arbitraryRawAd(),
        (rawAd) => {
          const enriched = enrichAd(rawAd, new Date("2026-05-09"));
          const signalFields = [
            "run_duration_days", "impression_range", "hook_signal",
            "format_signal", "offer_signal", "cta_signal", "performance_tier"
          ];
          return signalFields.every((f) => f in enriched);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// classifyTiers — unit tests
// ---------------------------------------------------------------------------

describe("classifyTiers", () => {
  function makeEnrichedAd(compositeScore) {
    return {
      id: String(compositeScore),
      hook_signal: "unknown",
      format_signal: null,
      offer_signal: "none_detected",
      cta_signal: null,
      run_duration_days: null,
      composite_score: compositeScore,
      performance_tier: "unclassified"
    };
  }

  test("all ads are unclassified when fewer than 3", () => {
    const result = classifyTiers([makeEnrichedAd(5), makeEnrichedAd(10)]);
    expect(result.top).toHaveLength(0);
    expect(result.low).toHaveLength(0);
    expect(result.unclassified).toHaveLength(2);
  });

  test("all ads are unclassified for empty array", () => {
    const result = classifyTiers([]);
    expect(result.top).toHaveLength(0);
    expect(result.low).toHaveLength(0);
    expect(result.unclassified).toHaveLength(0);
  });

  test("classifies 3 ads into one per tier", () => {
    const result = classifyTiers([makeEnrichedAd(1), makeEnrichedAd(5), makeEnrichedAd(10)]);
    expect(result.top).toHaveLength(1);
    expect(result.low).toHaveLength(1);
    expect(result.unclassified).toHaveLength(1);
  });

  test("top performers have higher composite scores than low performers", () => {
    const ads = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(makeEnrichedAd);
    const result = classifyTiers(ads);
    const minTop = Math.min(...result.top.map((a) => a.composite_score));
    const maxLow = Math.max(...result.low.map((a) => a.composite_score));
    expect(minTop).toBeGreaterThanOrEqual(maxLow);
  });

  test("performance_tier field is set correctly on each ad", () => {
    const ads = [1, 5, 10].map(makeEnrichedAd);
    const result = classifyTiers(ads);
    for (const ad of result.top) expect(ad.performance_tier).toBe("top");
    for (const ad of result.low) expect(ad.performance_tier).toBe("low");
    for (const ad of result.unclassified) expect(ad.performance_tier).toBe("unclassified");
  });
});

// ---------------------------------------------------------------------------
// classifyTiers — property-based tests
// ---------------------------------------------------------------------------

describe("classifyTiers — property tests", () => {
  // Feature: market-intelligence-tool, Property 3: tier classification covers all ads
  test("Property 3: tier classification covers all ads", () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryEnrichedAd(), { minLength: 0, maxLength: 50 }),
        (ads) => {
          const report = buildIntelligenceReport(ads, "test", "US", null);
          const allTiered = [
            ...report.top_performers,
            ...report.low_performers,
            ...report.unclassified
          ];
          return allTiered.length === ads.length;
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: market-intelligence-tool, Property 4: small result sets are all unclassified
  test("Property 4: small result sets are all unclassified", () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryEnrichedAd(), { minLength: 0, maxLength: 2 }),
        (ads) => {
          const report = buildIntelligenceReport(ads, "test", "US", null);
          return report.top_performers.length === 0 && report.low_performers.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: market-intelligence-tool, Property 8: composite score ordering consistent with tier
  test("Property 8: composite score ordering consistent with tier", () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryEnrichedAd(), { minLength: 3, maxLength: 50 }),
        (ads) => {
          const report = buildIntelligenceReport(ads, "test", "US", null);
          if (report.top_performers.length === 0 || report.low_performers.length === 0) return true;
          const minTop = Math.min(...report.top_performers.map((a) => a.composite_score));
          const maxLow = Math.max(...report.low_performers.map((a) => a.composite_score));
          return minTop >= maxLow;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// computeFrequencies — unit tests
// ---------------------------------------------------------------------------

describe("computeFrequencies", () => {
  test("returns empty map for empty array", () => {
    expect(computeFrequencies([], "hook_signal")).toEqual({});
  });

  test("counts single value correctly", () => {
    const ads = [{ hook_signal: "question" }, { hook_signal: "question" }];
    expect(computeFrequencies(ads, "hook_signal")).toEqual({ question: 2 });
  });

  test("counts multiple distinct values", () => {
    const ads = [
      { hook_signal: "question" },
      { hook_signal: "ugc" },
      { hook_signal: "question" }
    ];
    const freq = computeFrequencies(ads, "hook_signal");
    expect(freq.question).toBe(2);
    expect(freq.ugc).toBe(1);
  });

  test("handles null field values by using 'null' as key", () => {
    const ads = [{ format_signal: null }, { format_signal: null }];
    const freq = computeFrequencies(ads, "format_signal");
    expect(freq["null"]).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// buildIntelligenceReport — unit tests
// ---------------------------------------------------------------------------

describe("buildIntelligenceReport", () => {
  test("returns correct empty report shape with 0 ads", () => {
    const report = buildIntelligenceReport([], "eco bottles", "US", null);
    expect(report.query).toBe("eco bottles");
    expect(report.country).toBe("US");
    expect(report.total_ads_analysed).toBe(0);
    expect(report.top_performers).toEqual([]);
    expect(report.low_performers).toEqual([]);
    expect(report.unclassified).toEqual([]);
    expect(report.pattern_analysis.top_performer_patterns).toBeDefined();
    expect(report.pattern_analysis.low_performer_patterns).toBeDefined();
    expect(typeof report.workflow_context.creative_brief_hint).toBe("string");
    expect(typeof report.workflow_context.offer_strategy_hint).toBe("string");
  });

  test("workflow_context notes no competitor data when 0 ads", () => {
    const report = buildIntelligenceReport([], "test", "US", null);
    expect(report.workflow_context.creative_brief_hint.toLowerCase()).toMatch(/no competitor/);
  });

  test("total_ads_analysed matches input length", () => {
    const ads = [{ composite_score: 1 }, { composite_score: 5 }, { composite_score: 10 }].map((a) => ({
      ...a,
      hook_signal: "unknown",
      format_signal: null,
      offer_signal: "none_detected",
      cta_signal: null,
      run_duration_days: null,
      performance_tier: "unclassified",
      id: String(a.composite_score)
    }));
    const report = buildIntelligenceReport(ads, "test", "US", null);
    expect(report.total_ads_analysed).toBe(3);
  });

  test("brand_context appears in creative_brief_hint when provided", () => {
    const ads = Array.from({ length: 5 }, (_, i) => ({
      id: String(i),
      hook_signal: "question",
      format_signal: "video",
      offer_signal: "discount",
      cta_signal: "SHOP_NOW",
      run_duration_days: 30,
      composite_score: i * 2,
      performance_tier: "unclassified"
    }));
    const report = buildIntelligenceReport(ads, "test", "US", "Eco water bottles");
    expect(report.workflow_context.creative_brief_hint).toContain("Eco water bottles");
  });

  test("pattern_analysis has both top and low performer patterns", () => {
    const report = buildIntelligenceReport([], "test", "US", null);
    expect(report.pattern_analysis).toHaveProperty("top_performer_patterns");
    expect(report.pattern_analysis).toHaveProperty("low_performer_patterns");
    const p = report.pattern_analysis.top_performer_patterns;
    expect(p).toHaveProperty("hook_frequencies");
    expect(p).toHaveProperty("format_frequencies");
    expect(p).toHaveProperty("offer_frequencies");
    expect(p).toHaveProperty("cta_frequencies");
    expect(p).toHaveProperty("avg_run_duration_days");
  });
});

// ---------------------------------------------------------------------------
// buildIntelligenceReport — property-based tests
// ---------------------------------------------------------------------------

describe("buildIntelligenceReport — property tests", () => {
  // Feature: market-intelligence-tool, Property 5: frequency maps sum to tier size
  test("Property 5: frequency maps sum to tier size", () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryEnrichedAd(), { minLength: 3, maxLength: 50 }),
        (ads) => {
          const report = buildIntelligenceReport(ads, "test", "US", null);
          for (const tier of [report.top_performers, report.low_performers]) {
            const freqs = computeFrequencies(tier, "hook_signal");
            const total = Object.values(freqs).reduce((s, v) => s + v, 0);
            if (total !== tier.length) return false;
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: market-intelligence-tool, Property 6: Intelligence Report is JSON round-trippable
  test("Property 6: Intelligence Report is JSON round-trippable", () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryEnrichedAd(), { minLength: 0, maxLength: 30 }),
        (ads) => {
          const report = buildIntelligenceReport(ads, "test", "US", null);
          const roundTripped = JSON.parse(JSON.stringify(report));
          return JSON.stringify(roundTripped) === JSON.stringify(report);
        }
      ),
      { numRuns: 100 }
    );
  });
});
