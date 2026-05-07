/**
 * intelligence.js — Creative Intelligence Engine
 *
 * Pure functions only. No network calls, no imports from metaClient or config.
 * All exports are deterministic given the same inputs.
 */

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function numberOrNull(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

// ---------------------------------------------------------------------------
// Window splitting
// ---------------------------------------------------------------------------

/**
 * Split a chronologically ordered array of rows into baseline (first half)
 * and recent (second half).
 *
 * Returns { baseline: Row[], recent: Row[] } or { error } when rows < 4.
 */
export function splitWindow(rows) {
  if (!Array.isArray(rows) || rows.length < 4) {
    return {
      error: {
        type: "invalid_input",
        message: `Anomaly detection requires at least 4 daily rows. Got ${rows?.length ?? 0}.`,
        retryable: false
      }
    };
  }
  const mid = Math.floor(rows.length / 2);
  return { baseline: rows.slice(0, mid), recent: rows.slice(mid) };
}

// ---------------------------------------------------------------------------
// Metric helpers
// ---------------------------------------------------------------------------

/**
 * Average a numeric metric across an array of rows, skipping nulls.
 * Returns null when no valid values exist.
 */
export function computeAvg(rows, metric) {
  const values = rows.map((r) => numberOrNull(r[metric])).filter((v) => v !== null);
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Compute (recentAvg - baselineAvg) / baselineAvg.
 * Returns null when baselineAvg is 0 or null.
 */
export function computeChangePct(baselineAvg, recentAvg) {
  if (baselineAvg == null || baselineAvg === 0) return null;
  if (recentAvg == null) return null;
  return (recentAvg - baselineAvg) / baselineAvg;
}

/**
 * Classify severity from |changePct|.
 * Always returns "low" | "medium" | "high".
 */
export function classifySeverity(changePct) {
  const abs = Math.abs(changePct ?? 0);
  if (abs >= 0.5) return "high";
  if (abs >= 0.3) return "medium";
  return "low";
}

// ---------------------------------------------------------------------------
// Root-cause classification
// ---------------------------------------------------------------------------

const ROOT_CAUSE_EXPLANATIONS = {
  auction_pressure: {
    plain_english_explanation:
      "Your CPM jumped significantly while CTR stayed stable. This usually means more advertisers entered your auction — not a creative problem. Your ads are still resonating, but you're paying more to show them.",
    recommended_action:
      "Check if a seasonal event or competitor launch is driving auction pressure. Consider testing new audiences or placements to find cheaper inventory."
  },
  creative_fatigue: {
    plain_english_explanation:
      "Frequency is rising while CTR is falling — your audience has seen these ads too many times and is tuning them out. This is the most common cause of declining performance after a strong start.",
    recommended_action:
      "Refresh the hook and first 3 seconds of your top ads. Use generate_creative_brief to get data-driven variation directions based on what was working."
  },
  tracking_break: {
    plain_english_explanation:
      "Spend is continuing but purchases have dropped to near-zero. This is almost always a tracking issue — not an ad performance issue. Your Pixel or Conversions API may have stopped firing.",
    recommended_action:
      "Check Meta Events Manager for purchase event activity. Verify your Pixel is firing on the order confirmation page. Do not pause campaigns until tracking is confirmed broken."
  },
  learning_phase_reset: {
    plain_english_explanation:
      "Day-to-day ROAS is highly volatile, which suggests the campaign is in or re-entered Meta's learning phase. This often happens after a budget change, audience edit, or creative swap.",
    recommended_action:
      "Avoid making further edits for at least 7 days. Let the algorithm stabilize. Only intervene if spend safety is at risk."
  },
  audience_saturation: {
    plain_english_explanation:
      "Reach is shrinking while frequency is climbing — you're showing ads to the same people repeatedly because the audience pool is exhausted. This leads to rising CPMs and declining CTR.",
    recommended_action:
      "Expand your audience targeting, test a lookalike audience, or broaden age/gender targeting. Consider Advantage+ audience if not already enabled."
  },
  offer_mismatch: {
    plain_english_explanation:
      "CTR is strong — people are clicking — but very few are buying. The ad is doing its job; the landing page, offer, or product page is not. This is a conversion problem, not a traffic problem.",
    recommended_action:
      "Review the product page for trust signals, offer clarity, and mobile speed. Use the 100m-offers skill to strengthen the offer. Check if the landing page matches the ad's promise."
  },
  budget_pacing: {
    plain_english_explanation:
      "Your current spend rate will significantly overshoot or undershoot your monthly budget. Left unchecked, this means either wasted budget or missed revenue opportunity.",
    recommended_action:
      "Run get_spend_pacing for a full projection and recommended daily budget adjustment. Requires owner approval before changing live budgets."
  }
};

/**
 * Evaluate all 7 root-cause signal patterns against baseline and recent rows.
 * Returns an array of root-cause objects (may be empty).
 *
 * Each root cause is evaluated independently — multiple can fire simultaneously.
 */
export function classifyRootCauses(baseline, recent, options = {}) {
  const { monthly_budget, minimum_spend_to_judge = 1500 } = options;
  const causes = [];

  const baselineCpm = computeAvg(baseline, "cpm");
  const recentCpm = computeAvg(recent, "cpm");
  const cpmChange = computeChangePct(baselineCpm, recentCpm);

  const baselineCtr = computeAvg(baseline, "ctr");
  const recentCtr = computeAvg(recent, "ctr");
  const ctrChange = computeChangePct(baselineCtr, recentCtr);

  const baselineFreq = computeAvg(baseline, "frequency");
  const recentFreq = computeAvg(recent, "frequency");

  const baselineReach = computeAvg(baseline, "reach");
  const recentReach = computeAvg(recent, "reach");

  const recentSpend = computeAvg(recent, "spend");
  const recentPurchases = computeAvg(recent, "purchases");

  const recentClicks = computeAvg(recent, "clicks");

  // 1. auction_pressure: CPM up >20%, CTR stable within ±10%
  if (
    cpmChange !== null && cpmChange > 0.2 &&
    ctrChange !== null && Math.abs(ctrChange) <= 0.1
  ) {
    causes.push({ root_cause: "auction_pressure", ...ROOT_CAUSE_EXPLANATIONS.auction_pressure });
  }

  // 2. creative_fatigue: frequency rising AND CTR declining
  if (
    baselineFreq !== null && recentFreq !== null && recentFreq > baselineFreq &&
    baselineCtr !== null && recentCtr !== null && recentCtr < baselineCtr
  ) {
    causes.push({ root_cause: "creative_fatigue", ...ROOT_CAUSE_EXPLANATIONS.creative_fatigue });
  }

  // 3. tracking_break: spend above minimum but purchases near zero
  if (
    recentSpend !== null && recentSpend > minimum_spend_to_judge &&
    recentPurchases !== null && recentPurchases < 0.5
  ) {
    causes.push({ root_cause: "tracking_break", ...ROOT_CAUSE_EXPLANATIONS.tracking_break });
  }

  // 4. learning_phase_reset: high coefficient of variation in daily ROAS
  const allRows = [...baseline, ...recent];
  const roasValues = allRows.map((r) => numberOrNull(r.roas)).filter((v) => v !== null);
  if (roasValues.length >= 3) {
    const mean = roasValues.reduce((s, v) => s + v, 0) / roasValues.length;
    if (mean > 0) {
      const variance = roasValues.reduce((s, v) => s + (v - mean) ** 2, 0) / roasValues.length;
      const cv = Math.sqrt(variance) / mean;
      if (cv > 0.4) {
        causes.push({ root_cause: "learning_phase_reset", ...ROOT_CAUSE_EXPLANATIONS.learning_phase_reset });
      }
    }
  }

  // 5. audience_saturation: reach declining AND frequency climbing
  if (
    baselineReach !== null && recentReach !== null && recentReach < baselineReach &&
    baselineFreq !== null && recentFreq !== null && recentFreq > baselineFreq
  ) {
    causes.push({ root_cause: "audience_saturation", ...ROOT_CAUSE_EXPLANATIONS.audience_saturation });
  }

  // 6. offer_mismatch: CTR > 1.5% but purchase rate < 2%
  if (
    recentCtr !== null && recentCtr > 1.5 &&
    recentPurchases !== null && recentClicks !== null && recentClicks > 0
  ) {
    const purchaseRate = recentPurchases / recentClicks;
    if (purchaseRate < 0.02) {
      causes.push({ root_cause: "offer_mismatch", ...ROOT_CAUSE_EXPLANATIONS.offer_mismatch });
    }
  }

  // 7. budget_pacing: projected spend deviates from monthly_budget by >15%
  if (monthly_budget != null && monthly_budget > 0) {
    const allSpend = allRows.map((r) => numberOrNull(r.spend)).filter((v) => v !== null);
    if (allSpend.length > 0) {
      const avgDaily = allSpend.reduce((s, v) => s + v, 0) / allSpend.length;
      const projected = avgDaily * 30;
      const deviation = Math.abs(projected - monthly_budget) / monthly_budget;
      if (deviation > 0.15) {
        causes.push({ root_cause: "budget_pacing", ...ROOT_CAUSE_EXPLANATIONS.budget_pacing });
      }
    }
  }

  return causes;
}

// ---------------------------------------------------------------------------
// detectAnomalies — main export
// ---------------------------------------------------------------------------

const ANOMALY_METRICS = ["spend", "cpm", "ctr", "roas", "cost_per_purchase", "frequency", "reach", "purchases"];

/**
 * Detect metric anomalies in a window of daily performance rows.
 *
 * @param {object[]} rows - Normalized daily rows from getDailyPerformance
 * @param {object} options
 * @param {number} [options.anomaly_threshold=0.2]
 * @param {number|null} [options.monthly_budget]
 * @param {number} [options.minimum_spend_to_judge=1500]
 * @returns {{ anomalies: object[], summary: string } | { error: object }}
 */
export function detectAnomalies(rows, options = {}) {
  const { anomaly_threshold = 0.2, monthly_budget = null, minimum_spend_to_judge = 1500 } = options;

  const split = splitWindow(rows);
  if (split.error) return split;

  const { baseline, recent } = split;
  const rootCauses = classifyRootCauses(baseline, recent, { monthly_budget, minimum_spend_to_judge });

  // Build a lookup from root_cause → entry for merging into metric anomalies
  const rootCauseByType = {};
  for (const rc of rootCauses) {
    rootCauseByType[rc.root_cause] = rc;
  }

  const anomalies = [];

  for (const metric of ANOMALY_METRICS) {
    const baselineAvg = computeAvg(baseline, metric);
    const recentAvg = computeAvg(recent, metric);
    const changePct = computeChangePct(baselineAvg, recentAvg);

    if (changePct === null) continue;
    if (Math.abs(changePct) <= anomaly_threshold) continue;

    // Find the most relevant root cause for this metric
    const rootCause = pickRootCauseForMetric(metric, rootCauses);

    anomalies.push({
      metric,
      baseline_avg: baselineAvg !== null ? round2(baselineAvg) : null,
      recent_avg: recentAvg !== null ? round2(recentAvg) : null,
      change_pct: round2(changePct),
      root_cause: rootCause?.root_cause ?? "unknown",
      plain_english_explanation: rootCause?.plain_english_explanation ?? buildGenericExplanation(metric, changePct),
      recommended_action: rootCause?.recommended_action ?? "Monitor this metric over the next 3–5 days before taking action.",
      severity: classifySeverity(changePct)
    });
  }

  // Also emit root causes that don't map to a single metric (e.g. learning_phase_reset, budget_pacing)
  for (const rc of rootCauses) {
    const alreadyCovered = anomalies.some((a) => a.root_cause === rc.root_cause);
    if (!alreadyCovered) {
      anomalies.push({
        metric: rootCauseMetric(rc.root_cause),
        baseline_avg: null,
        recent_avg: null,
        change_pct: null,
        root_cause: rc.root_cause,
        plain_english_explanation: rc.plain_english_explanation,
        recommended_action: rc.recommended_action,
        severity: "medium"
      });
    }
  }

  const summary =
    anomalies.length === 0
      ? "No significant anomalies detected in the selected window."
      : `${anomalies.length} anomaly${anomalies.length === 1 ? "" : "ies"} detected: ${anomalies.map((a) => a.root_cause).join(", ")}.`;

  return { anomalies, summary };
}

function pickRootCauseForMetric(metric, rootCauses) {
  const metricMap = {
    cpm: ["auction_pressure", "audience_saturation"],
    ctr: ["creative_fatigue", "offer_mismatch", "auction_pressure"],
    frequency: ["creative_fatigue", "audience_saturation"],
    reach: ["audience_saturation"],
    purchases: ["tracking_break", "offer_mismatch"],
    roas: ["learning_phase_reset", "offer_mismatch"],
    cost_per_purchase: ["offer_mismatch", "auction_pressure"],
    spend: ["budget_pacing"]
  };
  const candidates = metricMap[metric] ?? [];
  for (const candidate of candidates) {
    const found = rootCauses.find((rc) => rc.root_cause === candidate);
    if (found) return found;
  }
  return rootCauses[0] ?? null;
}

function rootCauseMetric(rootCause) {
  const map = {
    learning_phase_reset: "roas",
    budget_pacing: "spend",
    offer_mismatch: "purchases",
    tracking_break: "purchases",
    creative_fatigue: "ctr",
    audience_saturation: "reach",
    auction_pressure: "cpm"
  };
  return map[rootCause] ?? "unknown";
}

function buildGenericExplanation(metric, changePct) {
  const direction = changePct > 0 ? "increased" : "decreased";
  const pct = Math.abs(Math.round(changePct * 100));
  return `${metric.toUpperCase()} ${direction} by ${pct}% compared to the baseline period.`;
}

// ---------------------------------------------------------------------------
// Creative brief — hook type inference
// ---------------------------------------------------------------------------

const HOOK_KEYWORDS = [
  { keywords: ["ugc", "user generated", "user-generated"], type: "ugc" },
  { keywords: ["testimonial", "review", "customer", "client"], type: "testimonial" },
  { keywords: ["demo", "demonstration", "how to", "howto", "tutorial"], type: "demo" },
  { keywords: ["problem", "pain", "struggle", "issue", "challenge"], type: "problem_agitate" },
  { keywords: ["question", "?", "did you", "are you", "do you", "have you"], type: "question" },
  { keywords: ["stat", "statistic", "%", "percent", "study", "research", "data"], type: "stat_hook" },
  { keywords: ["founder", "story", "behind", "why we", "how we"], type: "founder_story" }
];

/**
 * Infer hook type from an ad name string using keyword pattern matching.
 * Returns a hook type string or "unknown".
 */
export function inferHookType(adName) {
  if (!adName || typeof adName !== "string") return "unknown";
  const lower = adName.toLowerCase();
  for (const { keywords, type } of HOOK_KEYWORDS) {
    if (keywords.some((kw) => lower.includes(kw))) return type;
  }
  return "unknown";
}

// ---------------------------------------------------------------------------
// Creative brief — ad selection
// ---------------------------------------------------------------------------

/**
 * Select top N ads by ROAS descending, capped at 10.
 * Filters by minimum spend.
 *
 * @param {object[]} rows - Normalized ad-level rows
 * @param {number} topN
 * @param {number} [minimumSpend=1500]
 * @returns {object[]} AdSummary array
 */
export function selectTopAds(rows, topN = 3, minimumSpend = 1500) {
  const cappedN = Math.min(topN, 10);

  return rows
    .filter((r) => (r.spend ?? 0) >= minimumSpend)
    .sort((a, b) => {
      const ra = a.roas ?? -Infinity;
      const rb = b.roas ?? -Infinity;
      return rb - ra;
    })
    .slice(0, cappedN)
    .map((r) => ({
      ad_id: r.ad_id ?? null,
      ad_name: r.ad_name ?? null,
      ctr: r.ctr ?? null,
      roas: r.roas ?? null,
      cost_per_purchase: r.cost_per_purchase ?? null,
      spend: r.spend ?? 0,
      purchases: r.purchases ?? null,
      hook_type: inferHookType(r.ad_name)
    }));
}

// ---------------------------------------------------------------------------
// Creative brief — brief generation
// ---------------------------------------------------------------------------

const VARIATION_TEMPLATES = [
  {
    label: "Amplify the winner",
    hook: "Lead with the same hook type that drove the winning ad, but with a fresh angle and new opening line.",
    format: "video (15–30s) or single image",
    angle: "Double down on the proven angle with a new creative execution.",
    copy_direction: "Mirror the tone and promise of the winning ad. Change the hook sentence and visual but keep the offer identical.",
    visual_direction: "Use the same product or person but in a different setting or with a different action shot."
  },
  {
    label: "Contrast angle",
    hook: "Open with the problem or pain point the product solves — before/after or 'stop doing X' framing.",
    format: "UGC-style video or carousel",
    angle: "Problem-agitate-solve. Make the viewer feel the pain before presenting the solution.",
    copy_direction: "Start with a relatable frustration. Agitate it briefly. Then introduce the product as the obvious fix.",
    visual_direction: "Show the 'before' state visually — messy, frustrated, or struggling — then cut to the result."
  },
  {
    label: "Social proof angle",
    hook: "Lead with a specific result, number, or customer outcome — not a product feature.",
    format: "testimonial video or static with quote overlay",
    angle: "Proof-first. Let a result or customer voice do the selling.",
    copy_direction: "Open with a specific outcome ('I went from X to Y in Z days'). Keep it conversational and specific.",
    visual_direction: "Real person, real environment. Avoid polished studio look. Authenticity outperforms production value here."
  }
];

/**
 * Build a structured creative brief from top-performing ads.
 *
 * @param {object[]} topAds - AdSummary array from selectTopAds
 * @param {string|null} brandContext - Optional brand/offer context string
 * @returns {object} CreativeBrief
 */
export function buildCreativeBrief(topAds, brandContext = null) {
  const topAd = topAds[0] ?? {};
  const avgRoas = topAds.length > 0
    ? round2(topAds.reduce((s, a) => s + (a.roas ?? 0), 0) / topAds.length)
    : null;
  const avgCtr = topAds.length > 0
    ? round2(topAds.reduce((s, a) => s + (a.ctr ?? 0), 0) / topAds.length)
    : null;

  const hookLabel = topAd.hook_type && topAd.hook_type !== "unknown"
    ? `${topAd.hook_type.replace(/_/g, " ")} hook`
    : "hook pattern";

  let winningPattern = `Top ${topAds.length} ad${topAds.length === 1 ? "" : "s"} averaged ${avgRoas ?? "N/A"}x ROAS and ${avgCtr ?? "N/A"}% CTR. ` +
    `The leading ad (${topAd.ad_name ?? "unnamed"}) used a ${hookLabel} and achieved ` +
    `${topAd.roas ?? "N/A"}x ROAS at ${topAd.cost_per_purchase != null ? `$${topAd.cost_per_purchase}` : "unknown"} cost per purchase.`;

  if (brandContext) {
    winningPattern += ` Brand context: ${brandContext}`;
  }

  const brief = VARIATION_TEMPLATES.map((template) => ({
    hook: template.hook,
    format: template.format,
    angle: template.angle,
    copy_direction: brandContext
      ? `${template.copy_direction} Brand context to weave in: ${brandContext}`
      : template.copy_direction,
    visual_direction: template.visual_direction
  }));

  return {
    winning_ads: topAds,
    winning_pattern: winningPattern,
    brief,
    meta_specs: {
      primary_text_max_chars: 125,
      headline_max_chars: 40,
      description_max_chars: 30,
      supported_formats: ["single_image", "carousel", "video", "collection"],
      note: "Front-load the hook in primary text. The first 125 chars are shown before 'See more' truncation."
    },
    skill_context: {
      skills: ["ad-creative", "100m-offers"],
      instruction:
        "Use the ad-creative skill to write copy for each variation direction above. " +
        "Use the 100m-offers skill if the winning pattern shows offer_mismatch — the problem is the offer, not the creative."
    },
    production_checklist: [
      "Brand assets: logo, product images, color palette",
      "Offer copy: headline, subheadline, CTA, guarantee statement",
      "Avatar description: who this is for, their pain, their dream outcome",
      "Social proof: at least one testimonial, review, or result stat",
      "Landing page URL confirmed and mobile-optimized",
      "UTM parameters planned for each variation",
      "Meta Pixel purchase event confirmed firing before launch"
    ]
  };
}

// ---------------------------------------------------------------------------
// Spend pacing
// ---------------------------------------------------------------------------

/**
 * Compute spend pacing and cash-flow projection from daily spend rows.
 *
 * @param {object[]} rows - Normalized daily rows (each must have spend and date_start)
 * @param {object} options
 * @param {number} options.monthly_budget
 * @param {number} options.gross_margin_pct - 0 < value <= 1
 * @param {number|null} [options.target_roas]
 * @param {Date|null} [options.referenceDate] - Override "today" for testing
 * @returns {object} PacingResult
 */
export function computeSpendPacing(rows, options = {}) {
  const { monthly_budget, gross_margin_pct, target_roas = null, referenceDate = null } = options;

  const today = referenceDate instanceof Date ? referenceDate : new Date();
  const year = today.getFullYear();
  const month = today.getMonth(); // 0-indexed

  // Days in the current month
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dayOfMonth = today.getDate();
  const daysRemaining = Math.max(0, daysInMonth - dayOfMonth);

  // Sum spend from rows
  const spendValues = rows.map((r) => numberOrNull(r.spend)).filter((v) => v !== null);
  const spendToDate = spendValues.reduce((s, v) => s + v, 0);
  const daysElapsed = Math.max(spendValues.length, 1);

  const avgDailySpend = round2(spendToDate / daysElapsed);

  // Projection
  const projectedMonthSpend = daysRemaining === 0
    ? round2(spendToDate)
    : round2(avgDailySpend * (daysElapsed + daysRemaining));

  const budgetRemaining = round2(monthly_budget - spendToDate);
  const recommendedDailyBudget = daysRemaining === 0
    ? 0
    : round2(budgetRemaining / daysRemaining);

  const breakevenRoas = round2(1 / gross_margin_pct);

  // ROAS-based profit projection
  const roasValues = rows.map((r) => numberOrNull(r.roas)).filter((v) => v !== null);
  const currentRoas = roasValues.length > 0
    ? roasValues.reduce((s, v) => s + v, 0) / roasValues.length
    : null;

  const projectedProfitLoss = currentRoas !== null
    ? round2((projectedMonthSpend * currentRoas * gross_margin_pct) - projectedMonthSpend)
    : null;

  // Pacing status
  let pacingStatus;
  if (spendToDate > monthly_budget) {
    pacingStatus = "at_risk";
  } else if (projectedMonthSpend > monthly_budget * 1.1) {
    pacingStatus = "overpacing";
  } else if (projectedMonthSpend < monthly_budget * 0.9) {
    pacingStatus = "underpacing";
  } else {
    pacingStatus = "on_track";
  }

  // Cash flow warning
  let cashFlowWarning = null;
  if (pacingStatus === "at_risk") {
    cashFlowWarning =
      `You have already spent $${round2(spendToDate)} against a $${monthly_budget} monthly budget. ` +
      `You are $${round2(spendToDate - monthly_budget)} over budget with ${daysRemaining} days remaining. ` +
      `Requires owner approval before adjusting budgets.`;
  } else if (pacingStatus === "overpacing") {
    cashFlowWarning =
      `At your current daily spend of $${avgDailySpend}, you are projected to spend $${projectedMonthSpend} ` +
      `this month — ${Math.round(((projectedMonthSpend - monthly_budget) / monthly_budget) * 100)}% over your $${monthly_budget} budget. ` +
      `Recommended daily budget to stay on track: $${recommendedDailyBudget}. Requires owner approval.`;
  }

  return {
    pacing_status: pacingStatus,
    projected_month_spend: projectedMonthSpend,
    budget_remaining: budgetRemaining,
    days_remaining: daysRemaining,
    avg_daily_spend: avgDailySpend,
    recommended_daily_budget: recommendedDailyBudget,
    projected_profit_loss: projectedProfitLoss,
    breakeven_roas: breakevenRoas,
    cash_flow_warning: cashFlowWarning
  };
}
