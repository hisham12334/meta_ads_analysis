# Requirements Document

## Introduction

The Creative Intelligence Engine adds three new analytical tools to the Meta Ads MCP server. Together they form a coherent diagnostic and planning layer on top of the existing performance data:

1. **`detect_anomalies`** — scans daily performance data for statistically significant deviations and classifies each one into a root-cause category with a plain-English explanation and recommended action.
2. **`generate_creative_brief`** — identifies top-performing ads by ROAS and produces a structured creative brief with variation directions, Meta ad specs, and skill references that an AI agent can act on.
3. **`get_spend_pacing`** — projects month-end spend against a monthly budget and computes cash-flow metrics including breakeven ROAS and projected profit/loss.

All new analytical logic lives in a pure-function module (`intelligence.js`) so it is fully testable without network calls. API orchestration stays in `metaClient.js` and tool registration stays in `server.js`.

---

## Glossary

- **Intelligence_Module**: The `src/intelligence.js` module containing all pure analytical functions for the Creative Intelligence Engine.
- **MetaClient**: The `src/metaClient.js` class that calls the Meta Graph API and delegates analysis to the Intelligence_Module.
- **Server**: The `src/server.js` MCP JSON-RPC server that registers tools and routes calls to MetaClient.
- **Anomaly**: A metric deviation that exceeds the configured threshold when comparing the recent period to the baseline period.
- **Baseline_Period**: The first half of the analysis window (e.g. days 1–7 of a 14-day window).
- **Recent_Period**: The second half of the analysis window (e.g. days 8–14 of a 14-day window).
- **Root_Cause**: One of seven enumerated categories that classifies the likely driver of an anomaly.
- **Creative_Brief**: A structured data object containing winning pattern analysis, three variation directions, Meta ad specs, skill references, and a production checklist.
- **Pacing_Status**: One of four enumerated states — `on_track`, `overpacing`, `underpacing`, `at_risk` — describing how current spend compares to the monthly budget trajectory.
- **Coefficient_of_Variation**: Standard deviation divided by mean; used to measure day-to-day ROAS volatility.

---

## Requirements

### Requirement 1: Anomaly Detection — Data Retrieval and Windowing

**User Story:** As a media buyer, I want the system to fetch and window daily performance data automatically, so that I can run anomaly detection without manually pulling and slicing data.

#### Acceptance Criteria

1. WHEN `detect_anomalies` is called with a `date_preset` or `time_range`, THE MetaClient SHALL fetch daily performance rows at the specified `level` (`campaign` or `adset`) using the existing `getDailyPerformance()` data path.
2. WHEN `detect_anomalies` is called without an explicit `date_preset` or `time_range`, THE MetaClient SHALL default to the last 14 days.
3. WHEN an `entity_id` is provided, THE MetaClient SHALL scope the daily performance fetch to that entity.
4. THE Intelligence_Module SHALL split the fetched rows into a Baseline_Period (first half) and a Recent_Period (second half) by chronological order.
5. IF the fetched row count is fewer than 4, THEN THE Intelligence_Module SHALL return an error indicating insufficient data for anomaly detection.

---

### Requirement 2: Anomaly Detection — Deviation Computation

**User Story:** As a media buyer, I want the system to compute percentage deviations between the baseline and recent periods for key metrics, so that I can see which metrics have moved significantly.

#### Acceptance Criteria

1. THE Intelligence_Module SHALL compute the average value of each metric across the Baseline_Period and the Recent_Period separately.
2. WHEN the Baseline_Period average for a metric is zero, THE Intelligence_Module SHALL skip deviation computation for that metric and omit it from anomaly results.
3. THE Intelligence_Module SHALL compute `change_pct` as `(recent_avg - baseline_avg) / baseline_avg`.
4. WHEN `abs(change_pct)` exceeds `anomaly_threshold` (default `0.2`), THE Intelligence_Module SHALL flag that metric as an Anomaly.
5. THE Intelligence_Module SHALL evaluate deviations for at minimum these metrics: `spend`, `cpm`, `ctr`, `roas`, `cost_per_purchase`, `frequency`, `reach`, `purchases`.

---

### Requirement 3: Anomaly Detection — Root-Cause Classification

**User Story:** As a media buyer, I want each anomaly classified into a root-cause category with a plain-English explanation, so that I know what is likely driving the change and what to do about it.

#### Acceptance Criteria

1. WHEN CPM rises more than 20% AND CTR change is within ±10%, THE Intelligence_Module SHALL classify the anomaly as `auction_pressure`.
2. WHEN frequency is rising AND CTR is declining together, THE Intelligence_Module SHALL classify the anomaly as `creative_fatigue`.
3. WHEN spend exceeds `minimum_spend_to_judge` (default `1500`) AND purchases drop to zero or near-zero in the Recent_Period, THE Intelligence_Module SHALL classify the anomaly as `tracking_break`.
4. WHEN the coefficient of variation of daily ROAS across the full window exceeds `0.4`, THE Intelligence_Module SHALL classify the anomaly as `learning_phase_reset`.
5. WHEN reach is declining AND frequency is climbing, THE Intelligence_Module SHALL classify the anomaly as `audience_saturation`.
6. WHEN CTR exceeds `1.5%` AND purchase rate (purchases / clicks) is below `2%`, THE Intelligence_Module SHALL classify the anomaly as `offer_mismatch`.
7. WHEN `monthly_budget` is provided AND projected month-end spend deviates from `monthly_budget` by more than `15%`, THE Intelligence_Module SHALL classify the anomaly as `budget_pacing`.
8. THE Intelligence_Module SHALL assign `severity` of `high` when `abs(change_pct) >= 0.5`, `medium` when `abs(change_pct) >= 0.3`, and `low` otherwise.
9. THE Intelligence_Module SHALL include a `plain_english_explanation` string and a `recommended_action` string for every classified anomaly.
10. WHEN multiple root-cause signals are present for the same data window, THE Intelligence_Module SHALL return one anomaly entry per root-cause category detected.

---

### Requirement 4: Anomaly Detection — Tool Output

**User Story:** As a media buyer, I want `detect_anomalies` to return a structured list of anomalies with all diagnostic fields, so that I or an AI agent can act on the findings immediately.

#### Acceptance Criteria

1. THE Server SHALL register `detect_anomalies` as an MCP tool with an `inputSchema` of type `object` with `additionalProperties: false`.
2. THE Server SHALL accept these input fields for `detect_anomalies`: `date_preset` (string, optional), `time_range` (object, optional), `level` (enum `campaign`/`adset`, optional, default `campaign`), `entity_id` (string, optional), `anomaly_threshold` (number, optional, default `0.2`), `monthly_budget` (number, optional), `minimum_spend_to_judge` (number, optional, default `1500`).
3. WHEN `detect_anomalies` succeeds, THE MetaClient SHALL return an object with an `anomalies` array where each entry contains: `metric`, `baseline_avg`, `recent_avg`, `change_pct`, `root_cause`, `plain_english_explanation`, `recommended_action`, `severity`.
4. WHEN no anomalies are detected, THE MetaClient SHALL return `{ anomalies: [], summary: "No significant anomalies detected in the selected window." }`.
5. IF the Meta API call fails, THEN THE MetaClient SHALL propagate the error object in the same format used by existing tools.

---

### Requirement 5: Creative Brief Generator — Ad Selection

**User Story:** As a creative director, I want the system to identify top-performing ads automatically, so that I can generate briefs based on real performance data without manually finding winning ads.

#### Acceptance Criteria

1. WHEN an `ad_id` is provided, THE MetaClient SHALL fetch performance data for that specific ad and use it as the sole input for brief generation.
2. WHEN no `ad_id` is provided but an `adset_id` or `campaign_id` is provided, THE MetaClient SHALL fetch ad-level performance for that entity and select the top `top_n` ads ranked by ROAS descending.
3. WHEN `top_n` is not provided, THE MetaClient SHALL default to `3`.
4. WHEN `top_n` exceeds `10`, THE Intelligence_Module SHALL cap the selection at `10` ads.
5. WHEN no ads meet the `minimum_spend_to_judge` threshold, THE MetaClient SHALL return an error indicating insufficient spend data for brief generation.
6. THE Intelligence_Module SHALL extract these fields from each selected ad: `ad_id`, `ad_name`, `ctr`, `roas`, `cost_per_purchase`, `spend`, `purchases`.

---

### Requirement 6: Creative Brief Generator — Pattern Extraction and Brief Structure

**User Story:** As a creative director, I want the brief to contain data-driven variation directions and production guidance, so that a creator can start production without needing to interpret raw metrics.

#### Acceptance Criteria

1. THE Intelligence_Module SHALL infer `hook_type` from the `ad_name` string using keyword pattern matching (e.g. presence of "ugc", "testimonial", "demo", "problem", "question", "stat" maps to corresponding hook types; unrecognized patterns map to `unknown`).
2. THE Intelligence_Module SHALL populate `winning_pattern` with a data-driven summary referencing the ad's actual `ctr`, `roas`, and `cost_per_purchase` values.
3. THE Intelligence_Module SHALL generate exactly 3 variation directions in the `brief` array, each containing: `hook`, `format`, `angle`, `copy_direction`, `visual_direction`.
4. THE Intelligence_Module SHALL include a `meta_specs` object with character limits and format guidance for Meta ads (primary text ≤ 125 chars, headline ≤ 40 chars, description ≤ 30 chars, supported formats: single image, carousel, video, collection).
5. THE Intelligence_Module SHALL include a `skill_context` object referencing the `ad-creative` and `100m-offers` skills for the agent to use during brief execution.
6. THE Intelligence_Module SHALL include a `production_checklist` array of strings listing what the creator needs before starting (e.g. brand assets, offer copy, avatar description).
7. WHEN `brand_context` is provided, THE Intelligence_Module SHALL incorporate it into the `winning_pattern` summary and `copy_direction` fields of the brief.

---

### Requirement 7: Creative Brief Generator — Tool Output

**User Story:** As a creative director, I want `generate_creative_brief` to return a complete, self-contained brief object, so that an AI agent can use it directly with the ad-creative skill without additional data fetching.

#### Acceptance Criteria

1. THE Server SHALL register `generate_creative_brief` as an MCP tool with an `inputSchema` of type `object` with `additionalProperties: false`.
2. THE Server SHALL accept these input fields: `ad_id` (string, optional), `adset_id` (string, optional), `campaign_id` (string, optional), `date_preset` (string, optional), `top_n` (number, optional, default `3`), `brand_context` (string, optional).
3. WHEN `generate_creative_brief` succeeds, THE MetaClient SHALL return an object containing: `winning_ads` (array of selected ad summaries), `winning_pattern` (string), `brief` (array of 3 variation objects), `meta_specs` (object), `skill_context` (object), `production_checklist` (array of strings).
4. IF neither `ad_id`, `adset_id`, nor `campaign_id` is provided, THEN THE MetaClient SHALL return an error requiring at least one scoping parameter.
5. IF the Meta API call fails, THEN THE MetaClient SHALL propagate the error in the standard error format.

---

### Requirement 8: Spend Pacing — Computation

**User Story:** As an account manager, I want the system to compute spend pacing and cash-flow projections from daily spend data, so that I can see at a glance whether the account is on track and what the financial outcome will be.

#### Acceptance Criteria

1. THE Intelligence_Module SHALL compute `days_elapsed` and `days_remaining` from the current date and the month boundary (or provided `time_range`).
2. THE Intelligence_Module SHALL compute `avg_daily_spend` as total spend to date divided by `days_elapsed`.
3. THE Intelligence_Module SHALL compute `projected_month_spend` as `avg_daily_spend × (days_elapsed + days_remaining)`.
4. THE Intelligence_Module SHALL compute `budget_remaining` as `monthly_budget - spend_to_date`.
5. THE Intelligence_Module SHALL compute `recommended_daily_budget` as `budget_remaining / days_remaining`.
6. WHEN `days_remaining` is zero, THE Intelligence_Module SHALL set `recommended_daily_budget` to `0` and `projected_month_spend` to `spend_to_date`.
7. THE Intelligence_Module SHALL classify `pacing_status` as:
   - `on_track` when `projected_month_spend` is within ±10% of `monthly_budget`
   - `overpacing` when `projected_month_spend` exceeds `monthly_budget` by more than 10%
   - `underpacing` when `projected_month_spend` is more than 10% below `monthly_budget`
   - `at_risk` when `budget_remaining` is negative (already overspent)
8. WHEN `gross_margin_pct` and current ROAS data are available, THE Intelligence_Module SHALL compute `projected_profit_loss` as `(projected_month_spend × current_roas × gross_margin_pct) - projected_month_spend`.
9. THE Intelligence_Module SHALL compute `breakeven_roas` as `1 / gross_margin_pct`.
10. WHEN `pacing_status` is `overpacing` or `at_risk`, THE Intelligence_Module SHALL populate `cash_flow_warning` with a plain-English warning string; otherwise `cash_flow_warning` SHALL be `null`.

---

### Requirement 9: Spend Pacing — Tool Output

**User Story:** As an account manager, I want `get_spend_pacing` to return all pacing and cash-flow fields in one call, so that I can make budget decisions without running multiple queries.

#### Acceptance Criteria

1. THE Server SHALL register `get_spend_pacing` as an MCP tool with an `inputSchema` of type `object` with `additionalProperties: false`.
2. THE Server SHALL accept these input fields: `monthly_budget` (number, required), `gross_margin_pct` (number, required, range 0–1), `target_roas` (number, optional), `time_range` (object, optional).
3. WHEN `get_spend_pacing` succeeds, THE MetaClient SHALL return an object containing: `pacing_status`, `projected_month_spend`, `budget_remaining`, `days_remaining`, `avg_daily_spend`, `recommended_daily_budget`, `projected_profit_loss`, `breakeven_roas`, `cash_flow_warning`.
4. IF `monthly_budget` is not provided or is not a positive number, THEN THE MetaClient SHALL return a validation error.
5. IF `gross_margin_pct` is not in the range (0, 1], THEN THE MetaClient SHALL return a validation error.
6. IF the Meta API call fails, THEN THE MetaClient SHALL propagate the error in the standard error format.

---

### Requirement 10: Module Architecture and Testability

**User Story:** As a developer, I want all analytical logic isolated in pure functions, so that I can test the engine without mocking the Meta API.

#### Acceptance Criteria

1. THE Intelligence_Module SHALL export all analytical functions as named ES module exports with no side effects and no network calls.
2. THE Intelligence_Module SHALL be importable by `intelligence.test.js` without any environment variables or network access.
3. THE MetaClient SHALL call Intelligence_Module functions by importing them, passing normalized row data as plain JavaScript objects.
4. THE Intelligence_Module test suite SHALL achieve greater than 80% line coverage of `intelligence.js` as measured by Jest's built-in coverage reporter.
5. WHEN the test suite is run with `npm test`, THE Server SHALL not require any changes to the existing Jest configuration.

---

### Requirement 11: Ad-Creative Skill Installation

**User Story:** As an AI agent operator, I want the ad-creative skill available locally, so that the agent can use it offline without fetching from an external source.

#### Acceptance Criteria

1. THE skill file SHALL be created at `meta-ads-agency-harness/skills/ad-creative-skill/SKILL.md`.
2. THE skill file SHALL follow the same front-matter and content format as the existing `100m-offers-skill/SKILL.md`.
3. THE skill file SHALL describe how to analyze winning ad patterns, write hooks, and structure ad copy for Meta placements.

---

### Requirement 12: Creative Intelligence Workflow Document

**User Story:** As an AI agent operator, I want a workflow document that explains how to use the three new tools together, so that the agent can execute a full creative intelligence review in the correct sequence.

#### Acceptance Criteria

1. THE workflow document SHALL be created at `meta-ads-agency-harness/harness/CREATIVE_INTELLIGENCE_WORKFLOW.md`.
2. THE workflow document SHALL describe the recommended sequence: run `detect_anomalies` first, then `generate_creative_brief` for flagged entities, then `get_spend_pacing` for budget context.
3. THE workflow document SHALL include example tool calls with representative input parameters.
4. THE workflow document SHALL reference the `ad-creative` and `100m-offers` skills and explain when to invoke each.
