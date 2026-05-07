const PURCHASE_ACTION_TYPES = new Set([
  "purchase",
  "omni_purchase",
  "offsite_conversion.fb_pixel_purchase",
  "onsite_conversion.purchase",
  "web_in_store_purchase",
  "app_custom_event.fb_mobile_purchase"
]);

export function normalizeInsight(row) {
  const spend = numberOrNull(row.spend);
  const purchases = sumActionValues(row.actions, PURCHASE_ACTION_TYPES);
  const purchaseValue = sumActionValues(row.action_values, PURCHASE_ACTION_TYPES);
  const roas = firstRoas(row.purchase_roas) ?? firstRoas(row.website_purchase_roas);
  const inlineLinkClicks = numberOrNull(row.inline_link_clicks);
  const impressions = numberOrNull(row.impressions);
  const clicks = numberOrNull(row.clicks);

  return {
    ...row,
    spend,
    impressions,
    reach: numberOrNull(row.reach),
    frequency: numberOrNull(row.frequency),
    clicks,
    inline_link_clicks: inlineLinkClicks,
    ctr: numberOrNull(row.ctr),
    cpc: numberOrNull(row.cpc),
    cpm: numberOrNull(row.cpm),
    cpp: numberOrNull(row.cpp),
    purchases,
    purchase_value: purchaseValue,
    cost_per_purchase: spend && purchases ? round(spend / purchases) : null,
    roas: roas ?? (spend && purchaseValue ? round(purchaseValue / spend) : null),
    link_click_rate:
      impressions && inlineLinkClicks ? round((inlineLinkClicks / impressions) * 100) : null,
    warnings: buildMetricWarnings(row, purchases, purchaseValue, roas)
  };
}

export function summarizeTrend(rows) {
  const normalized = rows.map(normalizeInsight);
  return {
    days: normalized,
    trend_summary: {
      spend_direction: direction(normalized.map((row) => row.spend)),
      roas_direction: direction(normalized.map((row) => row.roas)),
      conversion_volume: conversionVolume(normalized)
    }
  };
}

export function diagnoseRows(rows, options = {}) {
  const targetRoas = numberOrNull(options.target_roas) ?? 3;
  const targetCostPerPurchase = numberOrNull(options.target_cost_per_purchase);
  const minimumSpendToJudge = numberOrNull(options.minimum_spend_to_judge) ?? 1500;
  const normalized = rows.map(normalizeInsight);

  const winners = [];
  const watchlist = [];
  const losers = [];

  for (const row of normalized) {
    const entity = classifyEntity(row);
    const enoughSpend = (row.spend ?? 0) >= minimumSpendToJudge;
    const profitable = row.roas != null && row.roas >= targetRoas;
    const efficientCpa =
      targetCostPerPurchase == null ||
      (row.cost_per_purchase != null && row.cost_per_purchase <= targetCostPerPurchase);

    const result = {
      ...entity,
      spend: row.spend,
      purchases: row.purchases,
      cost_per_purchase: row.cost_per_purchase,
      roas: row.roas
    };

    if (!enoughSpend) {
      watchlist.push({
        ...result,
        reason: "Not enough spend yet to judge confidently."
      });
    } else if (profitable && efficientCpa) {
      winners.push({
        ...result,
        reason: "Above ROAS target with enough spend to judge."
      });
    } else {
      losers.push({
        ...result,
        reason: "Below target after enough spend to judge."
      });
    }
  }

  const recommendedActions = [
    ...winners.map((item) => ({
      action_type: "consider_scale",
      entity_type: item.entity_type,
      entity_id: item.entity_id,
      reason: item.reason,
      requires_human_approval: true
    })),
    ...losers.map((item) => ({
      action_type: "review_or_pause",
      entity_type: item.entity_type,
      entity_id: item.entity_id,
      reason: item.reason,
      requires_human_approval: true
    }))
  ];

  return {
    summary: buildDiagnosisSummary(winners, watchlist, losers),
    winners,
    watchlist,
    losers,
    recommended_actions: recommendedActions,
    questions_for_owner: buildOwnerQuestions(winners),
    warnings: collectWarnings(normalized)
  };
}

export function fatigueRows(rows) {
  return rows.map((row) => {
    const normalized = normalizeInsight(row);
    const frequency = normalized.frequency ?? 0;
    const ctr = normalized.ctr ?? 0;
    const cpm = normalized.cpm ?? 0;
    const fatigueRisk =
      frequency >= 4 && ctr < 1 ? "high" : frequency >= 3 || (cpm > 0 && ctr < 1) ? "medium" : "low";

    return {
      ad_id: row.ad_id ?? null,
      ad_name: row.ad_name ?? null,
      frequency: normalized.frequency,
      ctr: normalized.ctr,
      cpm: normalized.cpm,
      fatigue_risk: fatigueRisk,
      suggested_action: suggestedFatigueAction(fatigueRisk, normalized)
    };
  });
}

function numberOrNull(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function sumActionValues(actions, allowedTypes) {
  if (!Array.isArray(actions)) return null;
  let total = 0;
  let found = false;

  for (const action of actions) {
    if (!allowedTypes.has(action.action_type)) continue;
    const value = numberOrNull(action.value);
    if (value == null) continue;
    total += value;
    found = true;
  }

  return found ? round(total) : null;
}

function firstRoas(values) {
  if (!Array.isArray(values)) return null;
  for (const item of values) {
    const value = numberOrNull(item.value);
    if (value != null) return value;
  }
  return null;
}

function buildMetricWarnings(row, purchases, purchaseValue, roas) {
  const warnings = [];
  if (!Array.isArray(row.actions)) {
    warnings.push("Meta did not return actions, so purchase count may be unavailable.");
  }
  if (!Array.isArray(row.action_values)) {
    warnings.push("Meta did not return action_values, so purchase value may be unavailable.");
  }
  if (purchases == null) {
    warnings.push("No purchase-like action type was found in this row.");
  }
  if (purchaseValue == null && roas == null) {
    warnings.push("No purchase value or ROAS was available for this row.");
  }
  return warnings;
}

function direction(values) {
  const clean = values.filter((value) => value != null);
  if (clean.length < 3) return "insufficient_data";

  // Compare the average of the first half vs the average of the second half
  // to avoid a single outlier day skewing the direction signal.
  const mid = Math.floor(clean.length / 2);
  const firstHalf = clean.slice(0, mid);
  const secondHalf = clean.slice(mid);

  const avg = (arr) => arr.reduce((sum, v) => sum + v, 0) / arr.length;
  const firstAvg = avg(firstHalf);
  const secondAvg = avg(secondHalf);

  if (firstAvg === 0) return "insufficient_data";
  if (secondAvg > firstAvg * 1.1) return "up";
  if (secondAvg < firstAvg * 0.9) return "down";
  return "flat";
}

function conversionVolume(rows) {
  const total = rows.reduce((sum, row) => sum + (row.purchases ?? 0), 0);
  if (total >= 50) return "strong";
  if (total >= 10) return "sufficient";
  if (total > 0) return "thin";
  return "none";
}

function classifyEntity(row) {
  if (row.ad_id) {
    return { entity_type: "ad", entity_id: row.ad_id, entity_name: row.ad_name ?? null };
  }
  if (row.adset_id) {
    return { entity_type: "adset", entity_id: row.adset_id, entity_name: row.adset_name ?? null };
  }
  if (row.campaign_id) {
    return {
      entity_type: "campaign",
      entity_id: row.campaign_id,
      entity_name: row.campaign_name ?? null
    };
  }
  return { entity_type: "account", entity_id: row.account_id ?? null, entity_name: row.account_name ?? null };
}

function buildDiagnosisSummary(winners, watchlist, losers) {
  return `${winners.length} winners, ${watchlist.length} watchlist items, ${losers.length} losers based on the provided thresholds.`;
}

function buildOwnerQuestions(winners) {
  if (winners.length === 0) return [];
  return [
    "Is inventory sufficient if we increase spend on the winning campaigns or ad sets?",
    "Are margins stable enough to support scaling at the current cost per purchase?"
  ];
}

function collectWarnings(rows) {
  return [...new Set(rows.flatMap((row) => row.warnings ?? []))];
}

function suggestedFatigueAction(fatigueRisk, row) {
  if (fatigueRisk === "high") {
    return "Refresh the creative hook, first 3 seconds, or primary visual before increasing spend.";
  }
  if (row.ctr != null && row.ctr < 1) {
    return "Review thumbstop, offer clarity, and audience-message match.";
  }
  return "Keep monitoring. No urgent creative refresh signal from frequency and CTR alone.";
}

function round(value) {
  return Math.round(value * 100) / 100;
}
