import { loadConfig, validateConfig } from "./config.js";
import { diagnoseRows, fatigueRows, normalizeInsight, summarizeTrend } from "./metrics.js";

const INSIGHT_FIELDS = [
  "account_id",
  "account_name",
  "campaign_id",
  "campaign_name",
  "adset_id",
  "adset_name",
  "ad_id",
  "ad_name",
  "objective",
  "optimization_goal",
  "date_start",
  "date_stop",
  "spend",
  "impressions",
  "reach",
  "frequency",
  "clicks",
  "inline_link_clicks",
  "outbound_clicks",
  "ctr",
  "cpc",
  "cpm",
  "cpp",
  "actions",
  "action_values",
  "cost_per_action_type",
  "purchase_roas",
  "website_purchase_roas"
];

const ALLOWED_LEVELS = new Set(["account", "campaign", "adset", "ad"]);
const ALLOWED_BREAKDOWNS = new Set([
  "age",
  "gender",
  "country",
  "region",
  "publisher_platform",
  "platform_position",
  "device_platform",
  "impression_device"
]);

// Default minimum spend threshold used consistently across all tools.
export const DEFAULT_MINIMUM_SPEND_TO_JUDGE = 1500;

export class MetaAdsClient {
  constructor(config = loadConfig()) {
    this.config = config;
  }

  async getAdAccounts() {
    const validation = validateConfig(this.config, { needsAdAccount: false });
    if (!validation.ok) return validation;

    const response = await this.graphGet("/me/adaccounts", {
      fields: "id,name,currency,timezone_name,account_status",
      limit: 100
    });

    if (response.error) return response;
    return { accounts: response.data?.data ?? [] };
  }

  async getAccountSummary(input = {}) {
    const response = await this.getInsights({
      ...input,
      level: "account",
      limit: 1
    });

    if (response.error) return response;
    return normalizeInsight(response.rows[0] ?? {});
  }

  async getCampaignInsights(input = {}) {
    const minimumSpend = input.minimum_spend_to_judge ?? DEFAULT_MINIMUM_SPEND_TO_JUDGE;
    const response = await this.getInsights({
      ...input,
      level: "campaign"
    });

    if (response.error) return response;
    return {
      campaigns: response.rows.map((row) => withRecommendationContext(row, minimumSpend)),
      warnings: response.warnings,
      ...(response.pagination_warning ? { pagination_warning: response.pagination_warning } : {})
    };
  }

  async getAdsetInsights(input = {}) {
    const response = await this.getInsights({
      ...input,
      level: "adset",
      filtering: entityFilter("campaign.id", input.campaign_id)
    });

    if (response.error) return response;
    return {
      adsets: response.rows,
      warnings: response.warnings,
      ...(response.pagination_warning ? { pagination_warning: response.pagination_warning } : {})
    };
  }

  async getAdInsights(input = {}) {
    const response = await this.getInsights({
      ...input,
      level: "ad",
      filtering: entityFilter("adset.id", input.adset_id)
    });

    if (response.error) return response;
    return {
      ads: response.rows,
      warnings: response.warnings,
      ...(response.pagination_warning ? { pagination_warning: response.pagination_warning } : {})
    };
  }

  async getDailyPerformance(input = {}) {
    const level = input.level ?? "campaign";
    const entityId = input.entity_id;
    const response = await this.getInsights({
      ...input,
      level,
      time_increment: 1,
      filtering: entityId ? entityFilter(`${level}.id`, entityId) : undefined
    });

    if (response.error) return response;
    const trend = summarizeTrend(response.rows);
    return {
      level,
      entity_id: entityId ?? null,
      ...trend,
      warnings: response.warnings,
      ...(response.pagination_warning ? { pagination_warning: response.pagination_warning } : {})
    };
  }

  async getBreakdownInsights(input = {}) {
    const level = input.level ?? "adset";
    const entityId = input.entity_id;
    const breakdowns = validateBreakdowns(input.breakdowns ?? ["age", "gender"]);
    if (breakdowns.error) return breakdowns;

    const response = await this.getInsights({
      ...input,
      level,
      breakdowns: breakdowns.values.join(","),
      filtering: entityId ? entityFilter(`${level}.id`, entityId) : undefined
    });

    if (response.error) return response;
    return {
      breakdowns: breakdowns.values,
      rows: response.rows,
      warnings: response.warnings,
      ...(response.pagination_warning ? { pagination_warning: response.pagination_warning } : {})
    };
  }

  async getCreativeFatigueReport(input = {}) {
    const level = input.level ?? "ad";
    const entityId = input.entity_id;

    // Determine the correct filter field based on the parent level.
    // e.g. if level=ad and entity_id is a campaign, we can't filter directly —
    // callers should pass adset-level entity_id for ad-level scoping.
    const filterField = level === "ad" ? "adset.id" : `${level}.id`;

    const response = await this.getInsights({
      ...input,
      level: "ad",
      filtering: entityId ? entityFilter(filterField, entityId) : undefined
    });

    if (response.error) return response;
    return {
      ads: fatigueRows(response.rows),
      warnings: response.warnings,
      ...(response.pagination_warning ? { pagination_warning: response.pagination_warning } : {})
    };
  }

  async diagnosePerformance(input = {}) {
    const level = input.level ?? "campaign";
    const entityId = input.entity_id;

    // Build a parent-level filter when entity_id is provided.
    // e.g. level=adset + entity_id=campaign_id → filter adsets by campaign.
    const parentField =
      level === "adset" ? "campaign.id" :
      level === "ad" ? "adset.id" :
      null;

    const response = await this.getInsights({
      ...input,
      level,
      filtering: entityId && parentField ? entityFilter(parentField, entityId) : undefined
    });

    if (response.error) return response;
    return diagnoseRows(response.rows, input);
  }

  async getInsights(input = {}) {
    const validation = validateConfig(this.config);
    if (!validation.ok) return validation;

    const level = input.level ?? "campaign";
    if (!ALLOWED_LEVELS.has(level)) {
      return toolError("invalid_input", `Unsupported insights level: ${level}`, false);
    }

    // Validate time_range ordering when provided.
    if (input.time_range?.since && input.time_range?.until) {
      const since = new Date(input.time_range.since);
      const until = new Date(input.time_range.until);
      if (isNaN(since.getTime()) || isNaN(until.getTime())) {
        return toolError("invalid_input", "time_range.since and time_range.until must be valid dates (YYYY-MM-DD).", false);
      }
      if (since > until) {
        return toolError("invalid_input", "time_range.since must be before or equal to time_range.until.", false);
      }
    }

    const params = {
      fields: INSIGHT_FIELDS.join(","),
      level,
      limit: clampLimit(input.limit),
      time_increment: input.time_increment
    };

    applyDateParams(params, input);
    applyAttributionParams(params, input, this.config);

    if (input.breakdowns) params.breakdowns = input.breakdowns;
    if (input.filtering) params.filtering = JSON.stringify(input.filtering);

    const response = await this.graphGet(`/${this.config.adAccountId}/insights`, params);
    if (response.error) return response;

    const rows = (response.data?.data ?? []).map(normalizeInsight);
    const paging = response.data?.paging ?? null;

    // Warn callers when Meta has more pages than were fetched.
    const paginationWarning =
      paging?.next
        ? `Results are paginated. Only the first ${rows.length} rows were returned. Use a higher limit or narrow your date range to get complete data.`
        : null;

    return {
      rows,
      paging,
      warnings: [...new Set(rows.flatMap((row) => row.warnings ?? []))],
      ...(paginationWarning ? { pagination_warning: paginationWarning } : {})
    };
  }

  async graphGet(path, params = {}) {
    const url = new URL(`${this.config.graphBaseUrl}${path}`);
    url.searchParams.set("access_token", this.config.accessToken);

    for (const [key, value] of Object.entries(params)) {
      if (value == null || value === "") continue;
      url.searchParams.set(key, String(value));
    }

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok || data.error) {
        return normalizeMetaError(data.error, response.status);
      }

      return { data };
    } catch (error) {
      return toolError("network_error", error.message, true);
    }
  }
}

function applyDateParams(params, input) {
  if (input.time_range?.since && input.time_range?.until) {
    params.time_range = JSON.stringify(input.time_range);
    return;
  }

  params.date_preset = input.date_preset ?? "last_7d";
}

function applyAttributionParams(params, input, config) {
  const windows = input.action_attribution_windows ?? config.attributionWindows;
  if (Array.isArray(windows) && windows.length > 0) {
    params.action_attribution_windows = JSON.stringify(windows);
  }
}

function clampLimit(limit) {
  const parsed = Number(limit ?? 100);
  if (!Number.isFinite(parsed)) return 100;
  return Math.min(Math.max(Math.trunc(parsed), 1), 500);
}

function entityFilter(field, value) {
  if (!value) return undefined;
  return [{ field, operator: "EQUAL", value }];
}

function validateBreakdowns(breakdowns) {
  if (!Array.isArray(breakdowns) || breakdowns.length === 0) {
    return toolError("invalid_input", "breakdowns must be a non-empty array.", false);
  }

  const invalid = breakdowns.filter((breakdown) => !ALLOWED_BREAKDOWNS.has(breakdown));
  if (invalid.length > 0) {
    return toolError("invalid_input", `Unsupported breakdowns: ${invalid.join(", ")}`, false);
  }

  return { values: breakdowns };
}

function withRecommendationContext(row, minimumSpend = DEFAULT_MINIMUM_SPEND_TO_JUDGE) {
  const enoughSpend = (row.spend ?? 0) >= minimumSpend;
  let primaryIssue = null;

  if (row.ctr != null && row.ctr < 1) {
    primaryIssue = "low_ctr";
  } else if (row.purchases == null || row.purchases === 0) {
    primaryIssue = "no_purchases";
  } else if (row.roas != null && row.roas < 2) {
    primaryIssue = "low_roas";
  }

  return {
    ...row,
    recommendation_context: {
      enough_spend_to_judge: enoughSpend,
      primary_issue: primaryIssue
    }
  };
}

function normalizeMetaError(metaError, status) {
  const code = metaError?.code ?? status;
  const type =
    code === 190
      ? "auth_error"
      : status === 403 || code === 200
        ? "permission_error"
        : status === 429 || code === 4 || code === 17
          ? "rate_limit"
          : code === 100
            ? "invalid_field"
            : "unknown_error";

  return toolError(type, metaError?.message ?? "Meta API request failed.", type === "rate_limit", code);
}

function toolError(type, message, retryable = false, metaCode = null) {
  return {
    error: {
      type,
      message,
      meta_code: metaCode,
      retryable
    }
  };
}
