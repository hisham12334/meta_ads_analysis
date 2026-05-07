/**
 * Unit tests for metrics.js
 *
 * Run with: npm test
 */

import {
  normalizeInsight,
  summarizeTrend,
  diagnoseRows,
  fatigueRows
} from "./metrics.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRow(overrides = {}) {
  return {
    campaign_id: "c1",
    campaign_name: "Test Campaign",
    spend: "1000",
    impressions: "50000",
    reach: "40000",
    frequency: "1.25",
    clicks: "800",
    inline_link_clicks: "700",
    ctr: "1.6",
    cpc: "1.25",
    cpm: "20",
    cpp: "25",
    actions: [
      { action_type: "offsite_conversion.fb_pixel_purchase", value: "10" }
    ],
    action_values: [
      { action_type: "offsite_conversion.fb_pixel_purchase", value: "5000" }
    ],
    purchase_roas: null,
    website_purchase_roas: null,
    ...overrides
  };
}

// ---------------------------------------------------------------------------
// normalizeInsight
// ---------------------------------------------------------------------------

describe("normalizeInsight", () => {
  test("converts string numbers to floats", () => {
    const result = normalizeInsight(makeRow());
    expect(result.spend).toBe(1000);
    expect(result.impressions).toBe(50000);
    expect(result.ctr).toBe(1.6);
    expect(result.cpm).toBe(20);
  });

  test("extracts purchases from actions array", () => {
    const result = normalizeInsight(makeRow());
    expect(result.purchases).toBe(10);
  });

  test("extracts purchase_value from action_values array", () => {
    const result = normalizeInsight(makeRow());
    expect(result.purchase_value).toBe(5000);
  });

  test("calculates cost_per_purchase from spend and purchases", () => {
    const result = normalizeInsight(makeRow());
    expect(result.cost_per_purchase).toBe(100); // 1000 / 10
  });

  test("calculates roas from purchase_value and spend when purchase_roas absent", () => {
    const result = normalizeInsight(makeRow());
    expect(result.roas).toBe(5); // 5000 / 1000
  });

  test("prefers purchase_roas from Meta over calculated roas", () => {
    const result = normalizeInsight(
      makeRow({ purchase_roas: [{ value: "8.5" }] })
    );
    expect(result.roas).toBe(8.5);
  });

  test("calculates link_click_rate from inline_link_clicks and impressions", () => {
    const result = normalizeInsight(makeRow());
    // 700 / 50000 * 100 = 1.4
    expect(result.link_click_rate).toBe(1.4);
  });

  test("returns null for purchases when actions is missing", () => {
    const result = normalizeInsight(makeRow({ actions: null }));
    expect(result.purchases).toBeNull();
  });

  test("returns null for cost_per_purchase when purchases is null", () => {
    const result = normalizeInsight(makeRow({ actions: null }));
    expect(result.cost_per_purchase).toBeNull();
  });

  test("returns null for roas when both purchase_roas and purchase_value are missing", () => {
    const result = normalizeInsight(
      makeRow({ action_values: null, purchase_roas: null, website_purchase_roas: null })
    );
    expect(result.roas).toBeNull();
  });

  test("handles omni_purchase action type", () => {
    const result = normalizeInsight(
      makeRow({
        actions: [{ action_type: "omni_purchase", value: "3" }],
        action_values: [{ action_type: "omni_purchase", value: "900" }]
      })
    );
    expect(result.purchases).toBe(3);
    expect(result.purchase_value).toBe(900);
  });

  test("adds warnings when actions array is missing", () => {
    const result = normalizeInsight(makeRow({ actions: null }));
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some((w) => w.includes("actions"))).toBe(true);
  });

  test("returns no warnings for a complete row", () => {
    const result = normalizeInsight(makeRow());
    expect(result.warnings).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// summarizeTrend
// ---------------------------------------------------------------------------

describe("summarizeTrend", () => {
  function dayRow(spend, purchases) {
    return makeRow({
      spend: String(spend),
      actions: purchases > 0
        ? [{ action_type: "offsite_conversion.fb_pixel_purchase", value: String(purchases) }]
        : [],
      action_values: purchases > 0
        ? [{ action_type: "offsite_conversion.fb_pixel_purchase", value: String(purchases * 100) }]
        : []
    });
  }

  test("returns insufficient_data when fewer than 3 rows", () => {
    const result = summarizeTrend([dayRow(1000, 5), dayRow(1200, 6)]);
    expect(result.trend_summary.spend_direction).toBe("insufficient_data");
  });

  test("detects upward spend trend", () => {
    const rows = [dayRow(500, 5), dayRow(600, 6), dayRow(700, 7), dayRow(800, 8)];
    const result = summarizeTrend(rows);
    expect(result.trend_summary.spend_direction).toBe("up");
  });

  test("detects downward roas trend", () => {
    const rows = [
      makeRow({ spend: "1000", action_values: [{ action_type: "offsite_conversion.fb_pixel_purchase", value: "8000" }], actions: [{ action_type: "offsite_conversion.fb_pixel_purchase", value: "10" }] }),
      makeRow({ spend: "1000", action_values: [{ action_type: "offsite_conversion.fb_pixel_purchase", value: "7000" }], actions: [{ action_type: "offsite_conversion.fb_pixel_purchase", value: "10" }] }),
      makeRow({ spend: "1000", action_values: [{ action_type: "offsite_conversion.fb_pixel_purchase", value: "4000" }], actions: [{ action_type: "offsite_conversion.fb_pixel_purchase", value: "10" }] }),
      makeRow({ spend: "1000", action_values: [{ action_type: "offsite_conversion.fb_pixel_purchase", value: "3000" }], actions: [{ action_type: "offsite_conversion.fb_pixel_purchase", value: "10" }] })
    ];
    const result = summarizeTrend(rows);
    expect(result.trend_summary.roas_direction).toBe("down");
  });

  test("conversion_volume is none when no purchases", () => {
    const rows = [dayRow(500, 0), dayRow(600, 0), dayRow(700, 0)];
    const result = summarizeTrend(rows);
    expect(result.trend_summary.conversion_volume).toBe("none");
  });

  test("conversion_volume is strong when total purchases >= 50", () => {
    const rows = Array.from({ length: 5 }, () => dayRow(1000, 12));
    const result = summarizeTrend(rows);
    expect(result.trend_summary.conversion_volume).toBe("strong");
  });
});

// ---------------------------------------------------------------------------
// diagnoseRows
// ---------------------------------------------------------------------------

describe("diagnoseRows", () => {
  const options = {
    target_roas: 3,
    target_cost_per_purchase: 500,
    minimum_spend_to_judge: 1500
  };

  test("classifies a profitable row as a winner", () => {
    const row = makeRow({
      spend: "2000",
      actions: [{ action_type: "offsite_conversion.fb_pixel_purchase", value: "20" }],
      action_values: [{ action_type: "offsite_conversion.fb_pixel_purchase", value: "8000" }]
    });
    const result = diagnoseRows([row], options);
    expect(result.winners).toHaveLength(1);
    expect(result.losers).toHaveLength(0);
  });

  test("classifies a low-spend row as watchlist regardless of roas", () => {
    const row = makeRow({
      spend: "500",
      actions: [{ action_type: "offsite_conversion.fb_pixel_purchase", value: "5" }],
      action_values: [{ action_type: "offsite_conversion.fb_pixel_purchase", value: "5000" }]
    });
    const result = diagnoseRows([row], options);
    expect(result.watchlist).toHaveLength(1);
    expect(result.winners).toHaveLength(0);
  });

  test("classifies a high-spend low-roas row as a loser", () => {
    const row = makeRow({
      spend: "2000",
      actions: [{ action_type: "offsite_conversion.fb_pixel_purchase", value: "2" }],
      action_values: [{ action_type: "offsite_conversion.fb_pixel_purchase", value: "1000" }]
    });
    const result = diagnoseRows([row], options);
    expect(result.losers).toHaveLength(1);
  });

  test("all recommended_actions have requires_human_approval: true", () => {
    const rows = [
      makeRow({ spend: "2000", actions: [{ action_type: "offsite_conversion.fb_pixel_purchase", value: "20" }], action_values: [{ action_type: "offsite_conversion.fb_pixel_purchase", value: "8000" }] }),
      makeRow({ spend: "2000", actions: [{ action_type: "offsite_conversion.fb_pixel_purchase", value: "2" }], action_values: [{ action_type: "offsite_conversion.fb_pixel_purchase", value: "1000" }] })
    ];
    const result = diagnoseRows(rows, options);
    for (const action of result.recommended_actions) {
      expect(action.requires_human_approval).toBe(true);
    }
  });

  test("uses default minimum_spend_to_judge of 1500 when not provided", () => {
    const row = makeRow({ spend: "1000" });
    const result = diagnoseRows([row], {});
    expect(result.watchlist).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// fatigueRows
// ---------------------------------------------------------------------------

describe("fatigueRows", () => {
  test("flags high fatigue when frequency >= 4 and ctr < 1", () => {
    const row = makeRow({ frequency: "4.5", ctr: "0.6", cpm: "80" });
    const result = fatigueRows([row]);
    expect(result[0].fatigue_risk).toBe("high");
  });

  test("flags medium fatigue when frequency >= 3", () => {
    const row = makeRow({ frequency: "3.2", ctr: "1.5", cpm: "40" });
    const result = fatigueRows([row]);
    expect(result[0].fatigue_risk).toBe("medium");
  });

  test("flags low fatigue for healthy metrics", () => {
    const row = makeRow({ frequency: "1.5", ctr: "2.0", cpm: "30" });
    const result = fatigueRows([row]);
    expect(result[0].fatigue_risk).toBe("low");
  });

  test("includes suggested_action in every row", () => {
    const rows = [
      makeRow({ frequency: "5", ctr: "0.5" }),
      makeRow({ frequency: "1", ctr: "2" })
    ];
    const result = fatigueRows(rows);
    for (const row of result) {
      expect(typeof row.suggested_action).toBe("string");
      expect(row.suggested_action.length).toBeGreaterThan(0);
    }
  });
});
