/**
 * intelligence.test.js — Creative Intelligence Engine tests
 *
 * Covers: splitWindow, computeAvg, computeChangePct, classifySeverity,
 *         classifyRootCauses, detectAnomalies, inferHookType, selectTopAds,
 *         buildCreativeBrief, computeSpendPacing
 */

import {
  splitWindow,
  computeAvg,
  computeChangePct,
  classifySeverity,
  classifyRootCauses,
  detectAnomalies,
  inferHookType,
  selectTopAds,
  buildCreativeBrief,
  computeSpendPacing
} from "./intelligence.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRow(overrides = {}) {
  return {
    spend: 1000,
    cpm: 50,
    ctr: 1.5,
    roas: 4,
    cost_per_purchase: 250,
    frequency: 2,
    reach: 20000,
    purchases: 4,
    clicks: 200,
    date_start: "2026-05-01",
    ...overrides
  };
}

function makeRows(n, overrides = {}) {
  return Array.from({ length: n }, (_, i) =>
    makeRow({ date_start: `2026-05-${String(i + 1).padStart(2, "0")}`, ...overrides })
  );
}

// ---------------------------------------------------------------------------
// splitWindow
// ---------------------------------------------------------------------------

describe("splitWindow", () => {
  test("returns error for fewer than 4 rows", () => {
    expect(splitWindow([]).error).toBeDefined();
    expect(splitWindow(makeRows(3)).error).toBeDefined();
  });

  test("splits 4 rows into 2+2", () => {
    const { baseline, recent } = splitWindow(makeRows(4));
    expect(baseline).toHaveLength(2);
    expect(recent).toHaveLength(2);
  });

  test("splits 5 rows into 2+3", () => {
    const { baseline, recent } = splitWindow(makeRows(5));
    expect(baseline).toHaveLength(2);
    expect(recent).toHaveLength(3);
  });

  test("splits 6 rows into 3+3", () => {
    const { baseline, recent } = splitWindow(makeRows(6));
    expect(baseline).toHaveLength(3);
    expect(recent).toHaveLength(3);
  });

  // Feature: creative-intelligence-engine, Property 2: Baseline/recent split is exhaustive and non-overlapping
  test.each(
    Array.from({ length: 20 }, (_, i) => [i + 4])
  )("Property 2: split of %i rows is exhaustive and non-overlapping", (n) => {
    const rows = makeRows(n);
    const { baseline, recent } = splitWindow(rows);
    expect(baseline.length + recent.length).toBe(n);
    const baselineSet = new Set(baseline.map((r) => r.date_start));
    const recentSet = new Set(recent.map((r) => r.date_start));
    for (const d of recentSet) {
      expect(baselineSet.has(d)).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// computeAvg
// ---------------------------------------------------------------------------

describe("computeAvg", () => {
  test("returns null for all-null rows", () => {
    const rows = [{ cpm: null }, { cpm: null }];
    expect(computeAvg(rows, "cpm")).toBeNull();
  });

  test("skips null values and averages the rest", () => {
    const rows = [{ cpm: 40 }, { cpm: null }, { cpm: 60 }];
    expect(computeAvg(rows, "cpm")).toBe(50);
  });

  test("returns single value when only one non-null", () => {
    const rows = [{ cpm: null }, { cpm: 80 }];
    expect(computeAvg(rows, "cpm")).toBe(80);
  });
});

// ---------------------------------------------------------------------------
// computeChangePct
// ---------------------------------------------------------------------------

describe("computeChangePct", () => {
  test("returns null when baseline is 0", () => {
    expect(computeChangePct(0, 100)).toBeNull();
  });

  test("returns null when baseline is null", () => {
    expect(computeChangePct(null, 100)).toBeNull();
  });

  test("returns null when recent is null", () => {
    expect(computeChangePct(100, null)).toBeNull();
  });

  test("computes positive change correctly", () => {
    expect(computeChangePct(100, 150)).toBeCloseTo(0.5);
  });

  test("computes negative change correctly", () => {
    expect(computeChangePct(100, 80)).toBeCloseTo(-0.2);
  });

  // Feature: creative-intelligence-engine, Property 3: change_pct formula identity
  test.each(
    Array.from({ length: 20 }, (_, i) => {
      const baseline = (i + 1) * 50;
      const recent = baseline * (0.5 + Math.random());
      return [baseline, recent];
    })
  )("Property 3: recent_avg = baseline_avg * (1 + change_pct) for baseline=%f recent=%f", (baseline, recent) => {
    const changePct = computeChangePct(baseline, recent);
    expect(baseline * (1 + changePct)).toBeCloseTo(recent, 5);
  });
});

// ---------------------------------------------------------------------------
// classifySeverity
// ---------------------------------------------------------------------------

describe("classifySeverity", () => {
  test("low for |changePct| < 0.3", () => {
    expect(classifySeverity(0.1)).toBe("low");
    expect(classifySeverity(-0.29)).toBe("low");
  });

  test("medium at boundary 0.3", () => {
    expect(classifySeverity(0.3)).toBe("medium");
    expect(classifySeverity(-0.3)).toBe("medium");
  });

  test("medium below 0.5", () => {
    expect(classifySeverity(0.49)).toBe("medium");
  });

  test("high at boundary 0.5", () => {
    expect(classifySeverity(0.5)).toBe("high");
    expect(classifySeverity(-0.5)).toBe("high");
  });

  test("high above 0.5", () => {
    expect(classifySeverity(1.2)).toBe("high");
  });

  // Feature: creative-intelligence-engine, Property 4: Severity classification covers all change_pct values
  test.each(
    Array.from({ length: 20 }, (_, i) => [(i - 10) * 0.15])
  )("Property 4: severity is always low/medium/high for changePct=%f", (changePct) => {
    const severity = classifySeverity(changePct);
    expect(["low", "medium", "high"]).toContain(severity);
  });
});

// ---------------------------------------------------------------------------
// classifyRootCauses
// ---------------------------------------------------------------------------

describe("classifyRootCauses", () => {
  test("detects auction_pressure: CPM up >20%, CTR stable", () => {
    const baseline = makeRows(3, { cpm: 50, ctr: 1.5 });
    const recent = makeRows(3, { cpm: 65, ctr: 1.5 }); // CPM +30%, CTR unchanged
    const causes = classifyRootCauses(baseline, recent);
    expect(causes.map((c) => c.root_cause)).toContain("auction_pressure");
  });

  test("does NOT detect auction_pressure when CTR also drops significantly", () => {
    const baseline = makeRows(3, { cpm: 50, ctr: 2.0 });
    const recent = makeRows(3, { cpm: 65, ctr: 1.0 }); // CTR dropped 50%
    const causes = classifyRootCauses(baseline, recent);
    expect(causes.map((c) => c.root_cause)).not.toContain("auction_pressure");
  });

  test("detects creative_fatigue: frequency up, CTR down", () => {
    const baseline = makeRows(3, { frequency: 1.5, ctr: 2.0 });
    const recent = makeRows(3, { frequency: 3.5, ctr: 0.8 });
    const causes = classifyRootCauses(baseline, recent);
    expect(causes.map((c) => c.root_cause)).toContain("creative_fatigue");
  });

  test("does NOT detect creative_fatigue when CTR is also rising", () => {
    const baseline = makeRows(3, { frequency: 1.5, ctr: 1.0 });
    const recent = makeRows(3, { frequency: 3.0, ctr: 2.5 });
    const causes = classifyRootCauses(baseline, recent);
    expect(causes.map((c) => c.root_cause)).not.toContain("creative_fatigue");
  });

  test("detects tracking_break: spend high, purchases near zero", () => {
    const baseline = makeRows(3, { spend: 2000, purchases: 10 });
    const recent = makeRows(3, { spend: 2000, purchases: 0 });
    const causes = classifyRootCauses(baseline, recent, { minimum_spend_to_judge: 1500 });
    expect(causes.map((c) => c.root_cause)).toContain("tracking_break");
  });

  test("does NOT detect tracking_break when spend is below minimum", () => {
    const baseline = makeRows(3, { spend: 500, purchases: 5 });
    const recent = makeRows(3, { spend: 500, purchases: 0 });
    const causes = classifyRootCauses(baseline, recent, { minimum_spend_to_judge: 1500 });
    expect(causes.map((c) => c.root_cause)).not.toContain("tracking_break");
  });

  test("detects learning_phase_reset: high ROAS coefficient of variation", () => {
    const allRows = [
      makeRow({ roas: 1 }), makeRow({ roas: 8 }), makeRow({ roas: 1.5 }),
      makeRow({ roas: 9 }), makeRow({ roas: 1 }), makeRow({ roas: 10 })
    ];
    const mid = 3;
    const causes = classifyRootCauses(allRows.slice(0, mid), allRows.slice(mid));
    expect(causes.map((c) => c.root_cause)).toContain("learning_phase_reset");
  });

  test("detects audience_saturation: reach down, frequency up", () => {
    const baseline = makeRows(3, { reach: 30000, frequency: 1.5 });
    const recent = makeRows(3, { reach: 15000, frequency: 4.0 });
    const causes = classifyRootCauses(baseline, recent);
    expect(causes.map((c) => c.root_cause)).toContain("audience_saturation");
  });

  test("detects offer_mismatch: high CTR, low purchase rate", () => {
    const baseline = makeRows(3, { ctr: 2.0, purchases: 5, clicks: 200 });
    const recent = makeRows(3, { ctr: 2.5, purchases: 1, clicks: 300 }); // purchase rate = 0.33%
    const causes = classifyRootCauses(baseline, recent);
    expect(causes.map((c) => c.root_cause)).toContain("offer_mismatch");
  });

  test("detects budget_pacing when projected spend deviates >15% from monthly_budget", () => {
    // avg daily spend ~2000, projected ~60000, budget 10000 → huge deviation
    const baseline = makeRows(3, { spend: 2000 });
    const recent = makeRows(3, { spend: 2000 });
    const causes = classifyRootCauses(baseline, recent, { monthly_budget: 10000 });
    expect(causes.map((c) => c.root_cause)).toContain("budget_pacing");
  });

  test("every root cause entry has non-empty plain_english_explanation and recommended_action", () => {
    const baseline = makeRows(3, { cpm: 50, ctr: 1.5, frequency: 1.5, reach: 30000, spend: 2000, purchases: 0 });
    const recent = makeRows(3, { cpm: 70, ctr: 1.5, frequency: 4.0, reach: 15000, spend: 2000, purchases: 0 });
    const causes = classifyRootCauses(baseline, recent, { minimum_spend_to_judge: 1500 });
    for (const cause of causes) {
      expect(typeof cause.plain_english_explanation).toBe("string");
      expect(cause.plain_english_explanation.length).toBeGreaterThan(0);
      expect(typeof cause.recommended_action).toBe("string");
      expect(cause.recommended_action.length).toBeGreaterThan(0);
    }
  });

  // Feature: creative-intelligence-engine, Property 5: Root-cause signals are mutually independent
  test("Property 5: multiple root causes can fire simultaneously", () => {
    // Set up rows that trigger both creative_fatigue AND audience_saturation
    const baseline = makeRows(3, { frequency: 1.5, ctr: 2.0, reach: 30000 });
    const recent = makeRows(3, { frequency: 4.0, ctr: 0.8, reach: 12000 });
    const causes = classifyRootCauses(baseline, recent);
    const types = causes.map((c) => c.root_cause);
    expect(types).toContain("creative_fatigue");
    expect(types).toContain("audience_saturation");
  });
});

// ---------------------------------------------------------------------------
// detectAnomalies
// ---------------------------------------------------------------------------

describe("detectAnomalies", () => {
  test("returns error when fewer than 4 rows", () => {
    const result = detectAnomalies(makeRows(3));
    expect(result.error).toBeDefined();
  });

  test("returns empty anomalies when no metric deviates beyond threshold", () => {
    const rows = makeRows(8); // all identical rows → no deviation
    const result = detectAnomalies(rows, { anomaly_threshold: 0.2 });
    expect(result.anomalies).toHaveLength(0);
    expect(result.summary).toMatch(/no significant/i);
  });

  test("detects CPM anomaly when CPM jumps significantly", () => {
    const rows = [
      ...makeRows(4, { cpm: 50 }),
      ...makeRows(4, { cpm: 90 }) // +80%
    ];
    const result = detectAnomalies(rows, { anomaly_threshold: 0.2 });
    const cpmAnomaly = result.anomalies.find((a) => a.metric === "cpm");
    expect(cpmAnomaly).toBeDefined();
    expect(cpmAnomaly.change_pct).toBeGreaterThan(0.2);
  });

  test("every anomaly entry has all required fields", () => {
    const rows = [
      ...makeRows(4, { cpm: 50, ctr: 2.0 }),
      ...makeRows(4, { cpm: 90, ctr: 0.5 })
    ];
    const result = detectAnomalies(rows, { anomaly_threshold: 0.1 });
    for (const anomaly of result.anomalies) {
      expect(anomaly).toHaveProperty("metric");
      expect(anomaly).toHaveProperty("baseline_avg");
      expect(anomaly).toHaveProperty("recent_avg");
      expect(anomaly).toHaveProperty("change_pct");
      expect(anomaly).toHaveProperty("root_cause");
      expect(anomaly).toHaveProperty("plain_english_explanation");
      expect(anomaly).toHaveProperty("recommended_action");
      expect(anomaly).toHaveProperty("severity");
    }
  });

  test("skips metric when baseline average is zero", () => {
    const rows = [
      ...makeRows(4, { purchases: 0 }),
      ...makeRows(4, { purchases: 10 })
    ];
    const result = detectAnomalies(rows, { anomaly_threshold: 0.2 });
    // purchases baseline is 0 → should not produce a change_pct anomaly for purchases
    const purchasesAnomaly = result.anomalies.find(
      (a) => a.metric === "purchases" && a.change_pct !== null
    );
    expect(purchasesAnomaly).toBeUndefined();
  });

  // Feature: creative-intelligence-engine, Property 1: Anomaly threshold monotonicity
  test.each(
    Array.from({ length: 10 }, (_, i) => {
      const highThreshold = 0.3 + i * 0.05;
      const lowThreshold = highThreshold - 0.1;
      return [lowThreshold, highThreshold];
    })
  )("Property 1: lower threshold (%f) never produces fewer anomalies than higher (%f)", (low, high) => {
    const rows = [
      ...makeRows(4, { cpm: 50, ctr: 2.0, roas: 5 }),
      ...makeRows(4, { cpm: 90, ctr: 0.8, roas: 2 })
    ];
    const lowResult = detectAnomalies(rows, { anomaly_threshold: low });
    const highResult = detectAnomalies(rows, { anomaly_threshold: high });
    expect(lowResult.anomalies.length).toBeGreaterThanOrEqual(highResult.anomalies.length);
  });
});

// ---------------------------------------------------------------------------
// inferHookType
// ---------------------------------------------------------------------------

describe("inferHookType", () => {
  test.each([
    ["UGC_Hook1_BenefitDemo", "ugc"],
    ["Testimonial_Customer_V2", "testimonial"],
    ["ProductDemo_30s", "demo"],
    ["Problem_PainPoint_Hook", "problem_agitate"],
    ["Question_AreYouTired", "question"],
    ["Stat_90Percent_Claim", "stat_hook"],
    ["Founder_Story_V1", "founder_story"],
    ["RandomAdName", "unknown"],
    ["", "unknown"]
  ])("maps '%s' → '%s'", (name, expected) => {
    expect(inferHookType(name)).toBe(expected);
  });

  test("returns unknown for null input", () => {
    expect(inferHookType(null)).toBe("unknown");
  });
});

// ---------------------------------------------------------------------------
// selectTopAds
// ---------------------------------------------------------------------------

describe("selectTopAds", () => {
  function makeAdRow(id, roas, spend = 2000) {
    return makeRow({ ad_id: id, ad_name: `Ad_${id}`, roas, spend });
  }

  test("filters out ads below minimum spend", () => {
    const rows = [makeAdRow("a", 5, 500), makeAdRow("b", 3, 2000)];
    const result = selectTopAds(rows, 3, 1500);
    expect(result).toHaveLength(1);
    expect(result[0].ad_id).toBe("b");
  });

  test("sorts by ROAS descending", () => {
    const rows = [makeAdRow("a", 3), makeAdRow("b", 7), makeAdRow("c", 5)];
    const result = selectTopAds(rows, 3);
    expect(result.map((r) => r.ad_id)).toEqual(["b", "c", "a"]);
  });

  // Feature: creative-intelligence-engine, Property 6: top_n cap
  test.each(
    Array.from({ length: 10 }, (_, i) => [i + 11])
  )("Property 6: topN=%i is capped at 10", (topN) => {
    const rows = Array.from({ length: 15 }, (_, i) => makeAdRow(`ad${i}`, i + 1));
    const result = selectTopAds(rows, topN);
    expect(result.length).toBeLessThanOrEqual(10);
  });

  // Feature: creative-intelligence-engine, Property 7: Top ads sorted by ROAS descending
  test.each(
    Array.from({ length: 10 }, (_, i) => {
      const roasValues = Array.from({ length: 5 }, () => Math.random() * 10 + 1);
      return [roasValues];
    })
  )("Property 7: ads are always sorted by ROAS descending", (roasValues) => {
    const rows = roasValues.map((roas, i) => makeAdRow(`ad${i}`, roas));
    const result = selectTopAds(rows, 10);
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].roas).toBeGreaterThanOrEqual(result[i].roas);
    }
  });

  test("includes hook_type in each result", () => {
    const rows = [makeRow({ ad_id: "x", ad_name: "UGC_Hook_Test", roas: 5, spend: 2000 })];
    const result = selectTopAds(rows, 3);
    expect(result[0].hook_type).toBe("ugc");
  });
});

// ---------------------------------------------------------------------------
// buildCreativeBrief
// ---------------------------------------------------------------------------

describe("buildCreativeBrief", () => {
  const topAds = [
    { ad_id: "1", ad_name: "UGC_Hook1", ctr: 2.5, roas: 8, cost_per_purchase: 125, spend: 2000, purchases: 16, hook_type: "ugc" },
    { ad_id: "2", ad_name: "Testimonial_V2", ctr: 1.8, roas: 5, cost_per_purchase: 200, spend: 1800, purchases: 9, hook_type: "testimonial" }
  ];

  test("returns exactly 3 variation directions", () => {
    const brief = buildCreativeBrief(topAds);
    expect(brief.brief).toHaveLength(3);
  });

  // Feature: creative-intelligence-engine, Property 8: Brief always contains exactly 3 variation directions
  test.each(
    Array.from({ length: 10 }, (_, i) => [i + 1])
  )("Property 8: brief always has 3 variations regardless of topAds count (%i ads)", (n) => {
    const ads = Array.from({ length: n }, (_, i) => ({
      ad_id: `${i}`, ad_name: `Ad_${i}`, ctr: 1.5, roas: 4, cost_per_purchase: 250,
      spend: 2000, purchases: 8, hook_type: "ugc"
    }));
    const brief = buildCreativeBrief(ads);
    expect(brief.brief).toHaveLength(3);
  });

  test("each variation has required fields", () => {
    const brief = buildCreativeBrief(topAds);
    for (const variation of brief.brief) {
      expect(variation).toHaveProperty("hook");
      expect(variation).toHaveProperty("format");
      expect(variation).toHaveProperty("angle");
      expect(variation).toHaveProperty("copy_direction");
      expect(variation).toHaveProperty("visual_direction");
    }
  });

  test("meta_specs has correct character limits", () => {
    const brief = buildCreativeBrief(topAds);
    expect(brief.meta_specs.primary_text_max_chars).toBe(125);
    expect(brief.meta_specs.headline_max_chars).toBe(40);
    expect(brief.meta_specs.description_max_chars).toBe(30);
  });

  test("meta_specs includes all 4 supported formats", () => {
    const brief = buildCreativeBrief(topAds);
    expect(brief.meta_specs.supported_formats).toContain("single_image");
    expect(brief.meta_specs.supported_formats).toContain("carousel");
    expect(brief.meta_specs.supported_formats).toContain("video");
    expect(brief.meta_specs.supported_formats).toContain("collection");
  });

  test("skill_context references both required skills", () => {
    const brief = buildCreativeBrief(topAds);
    expect(brief.skill_context.skills).toContain("ad-creative");
    expect(brief.skill_context.skills).toContain("100m-offers");
  });

  test("production_checklist is a non-empty string array", () => {
    const brief = buildCreativeBrief(topAds);
    expect(Array.isArray(brief.production_checklist)).toBe(true);
    expect(brief.production_checklist.length).toBeGreaterThan(0);
    for (const item of brief.production_checklist) {
      expect(typeof item).toBe("string");
    }
  });

  test("brand_context appears in winning_pattern when provided", () => {
    const brief = buildCreativeBrief(topAds, "Eco-friendly water bottles for gym-goers");
    expect(brief.winning_pattern).toContain("Eco-friendly water bottles");
  });

  test("brand_context appears in copy_direction when provided", () => {
    const brief = buildCreativeBrief(topAds, "Premium skincare for busy moms");
    for (const variation of brief.brief) {
      expect(variation.copy_direction).toContain("Premium skincare");
    }
  });

  test("winning_pattern references actual ROAS and CTR values", () => {
    const brief = buildCreativeBrief(topAds);
    expect(brief.winning_pattern).toMatch(/ROAS|roas/i);
    expect(brief.winning_pattern).toMatch(/CTR|ctr/i);
  });
});

// ---------------------------------------------------------------------------
// computeSpendPacing
// ---------------------------------------------------------------------------

describe("computeSpendPacing", () => {
  // Use a fixed reference date so tests are deterministic
  const REF_DATE = new Date(2026, 4, 15); // May 15, 2026 (month=4 is May)

  function makeSpendRows(n, dailySpend = 1000, dailyRoas = 4) {
    return Array.from({ length: n }, (_, i) => ({
      spend: dailySpend,
      roas: dailyRoas,
      date_start: `2026-05-${String(i + 1).padStart(2, "0")}`
    }));
  }

  const BASE_OPTIONS = {
    monthly_budget: 30000,
    gross_margin_pct: 0.4,
    referenceDate: REF_DATE
  };

  test("computes avg_daily_spend correctly", () => {
    const rows = makeSpendRows(10, 1500);
    const result = computeSpendPacing(rows, BASE_OPTIONS);
    expect(result.avg_daily_spend).toBe(1500);
  });

  test("computes budget_remaining correctly", () => {
    const rows = makeSpendRows(10, 1000); // 10 days × 1000 = 10000 spent
    const result = computeSpendPacing(rows, BASE_OPTIONS);
    expect(result.budget_remaining).toBe(20000); // 30000 - 10000
  });

  test("computes breakeven_roas as 1 / gross_margin_pct", () => {
    const rows = makeSpendRows(10, 1000);
    const result = computeSpendPacing(rows, { ...BASE_OPTIONS, gross_margin_pct: 0.4 });
    expect(result.breakeven_roas).toBeCloseTo(2.5);
  });

  test("pacing_status is at_risk when already overspent", () => {
    const rows = makeSpendRows(10, 4000); // 40000 spent > 30000 budget
    const result = computeSpendPacing(rows, BASE_OPTIONS);
    expect(result.pacing_status).toBe("at_risk");
  });

  test("pacing_status is overpacing when projected > budget * 1.1", () => {
    // 5 days elapsed, 16 remaining (ref=May15, daysInMonth=31, daysRemaining=16)
    // daily=2000 → spend_to_date=10000 < 30000 (not at_risk)
    // projected = 2000 * (5+16) = 42000 > 30000 * 1.1 = 33000 → overpacing
    const rows = makeSpendRows(5, 2000);
    const result = computeSpendPacing(rows, BASE_OPTIONS);
    expect(result.pacing_status).toBe("overpacing");
  });

  test("pacing_status is underpacing when projected < budget * 0.9", () => {
    // 15 days elapsed, 16 remaining, 500/day → projected = 500 * 31 = 15500 < 27000
    const rows = makeSpendRows(15, 500);
    const result = computeSpendPacing(rows, BASE_OPTIONS);
    expect(result.pacing_status).toBe("underpacing");
  });

  test("pacing_status is on_track when projected within ±10% of budget", () => {
    // 15 days elapsed, 16 remaining, ~968/day → projected ≈ 30000
    const dailySpend = 30000 / 31;
    const rows = makeSpendRows(15, dailySpend);
    const result = computeSpendPacing(rows, BASE_OPTIONS);
    expect(result.pacing_status).toBe("on_track");
  });

  test("cash_flow_warning is null when on_track", () => {
    const dailySpend = 30000 / 31;
    const rows = makeSpendRows(15, dailySpend);
    const result = computeSpendPacing(rows, BASE_OPTIONS);
    expect(result.cash_flow_warning).toBeNull();
  });

  test("cash_flow_warning is null when underpacing", () => {
    const rows = makeSpendRows(15, 500);
    const result = computeSpendPacing(rows, BASE_OPTIONS);
    expect(result.cash_flow_warning).toBeNull();
  });

  test("cash_flow_warning is a string when overpacing", () => {
    const rows = makeSpendRows(15, 2500);
    const result = computeSpendPacing(rows, BASE_OPTIONS);
    expect(typeof result.cash_flow_warning).toBe("string");
    expect(result.cash_flow_warning.length).toBeGreaterThan(0);
  });

  test("cash_flow_warning is a string when at_risk", () => {
    const rows = makeSpendRows(10, 4000);
    const result = computeSpendPacing(rows, BASE_OPTIONS);
    expect(typeof result.cash_flow_warning).toBe("string");
  });

  test("recommended_daily_budget is 0 when days_remaining is 0", () => {
    const lastDayRef = new Date(2026, 4, 31); // May 31
    const rows = makeSpendRows(31, 1000);
    const result = computeSpendPacing(rows, { ...BASE_OPTIONS, referenceDate: lastDayRef });
    expect(result.recommended_daily_budget).toBe(0);
  });

  test("computes projected_profit_loss when ROAS data available", () => {
    const rows = makeSpendRows(15, 1000, 5); // ROAS = 5
    const result = computeSpendPacing(rows, { ...BASE_OPTIONS, gross_margin_pct: 0.4 });
    // projected_profit_loss = (projected_spend * roas * margin) - projected_spend
    expect(result.projected_profit_loss).not.toBeNull();
  });

  // Feature: creative-intelligence-engine, Property 9: Pacing projection identity
  test.each(
    Array.from({ length: 10 }, (_, i) => [500 + i * 200])
  )("Property 9: projected_month_spend = avg_daily_spend * (elapsed + remaining) for spend=%f", (dailySpend) => {
    const rows = makeSpendRows(10, dailySpend);
    const result = computeSpendPacing(rows, BASE_OPTIONS);
    if (result.days_remaining > 0) {
      const expected = result.avg_daily_spend * (10 + result.days_remaining);
      expect(result.projected_month_spend).toBeCloseTo(expected, 1);
    }
  });

  // Feature: creative-intelligence-engine, Property 10: budget_remaining invariant
  test.each(
    Array.from({ length: 10 }, (_, i) => [500 + i * 300])
  )("Property 10: budget_remaining = monthly_budget - spend_to_date for spend=%f", (dailySpend) => {
    const rows = makeSpendRows(10, dailySpend);
    const spendToDate = dailySpend * 10;
    const result = computeSpendPacing(rows, BASE_OPTIONS);
    expect(result.budget_remaining).toBeCloseTo(30000 - spendToDate, 1);
  });

  // Feature: creative-intelligence-engine, Property 11: recommended_daily_budget identity
  test.each(
    Array.from({ length: 10 }, (_, i) => [500 + i * 200])
  )("Property 11: recommended_daily_budget = budget_remaining / days_remaining for spend=%f", (dailySpend) => {
    const rows = makeSpendRows(10, dailySpend);
    const result = computeSpendPacing(rows, BASE_OPTIONS);
    if (result.days_remaining > 0) {
      expect(result.recommended_daily_budget).toBeCloseTo(
        result.budget_remaining / result.days_remaining, 1
      );
    }
  });

  // Feature: creative-intelligence-engine, Property 12: breakeven_roas identity
  test.each(
    [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
  )("Property 12: breakeven_roas = 1 / gross_margin_pct for margin=%f", (margin) => {
    const rows = makeSpendRows(10, 1000);
    const result = computeSpendPacing(rows, { ...BASE_OPTIONS, gross_margin_pct: margin });
    // round2 limits precision to 2 decimal places, so compare with tolerance of 0.01
    expect(result.breakeven_roas).toBeCloseTo(1 / margin, 2);
  });

  // Feature: creative-intelligence-engine, Property 13: at_risk when overspent
  test.each(
    Array.from({ length: 10 }, (_, i) => [(i + 1) * 500 + 30000 / 10])
  )("Property 13: pacing_status is at_risk when spend_to_date > monthly_budget for daily=%f", (dailySpend) => {
    // 10 days × dailySpend > 30000 when dailySpend > 3000
    const rows = makeSpendRows(10, dailySpend);
    const spendToDate = dailySpend * 10;
    const result = computeSpendPacing(rows, BASE_OPTIONS);
    if (spendToDate > 30000) {
      expect(result.pacing_status).toBe("at_risk");
    }
  });

  // Feature: creative-intelligence-engine, Property 14: cash_flow_warning null when on_track or underpacing
  test.each(["on_track", "underpacing"])("Property 14: cash_flow_warning is null when pacing_status is %s", (status) => {
    const dailySpend = status === "underpacing" ? 400 : 30000 / 31;
    const rows = makeSpendRows(15, dailySpend);
    const result = computeSpendPacing(rows, BASE_OPTIONS);
    if (result.pacing_status === status) {
      expect(result.cash_flow_warning).toBeNull();
    }
  });
});
