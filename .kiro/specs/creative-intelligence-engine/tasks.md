# Implementation Plan: Creative Intelligence Engine

## Overview

Implement the three-tool Creative Intelligence Engine by building a pure-function `intelligence.js` module, extending `metaClient.js` with three new methods, registering three new tools in `server.js`, writing a comprehensive test suite, installing the ad-creative skill, and adding the workflow document.

## Tasks

- [x] 1. Create `src/intelligence.js` with anomaly detection core
  - Create the file with ES module exports (`export function`)
  - Implement `splitWindow(rows)` — splits a chronologically ordered array into baseline (first half) and recent (second half); returns `{ baseline, recent }` or an error object when `rows.length < 4`
  - Implement `computeAvg(rows, metric)` — returns the average of a numeric metric across an array of normalized rows, skipping null values; returns `null` when no valid values exist
  - Implement `computeChangePct(baselineAvg, recentAvg)` — returns `(recentAvg - baselineAvg) / baselineAvg`; returns `null` when `baselineAvg` is 0 or null
  - Implement `classifySeverity(changePct)` — returns `"high"` when `|changePct| >= 0.5`, `"medium"` when `>= 0.3`, `"low"` otherwise
  - _Requirements: 1.4, 1.5, 2.1, 2.2, 2.3, 3.8_

  - [ ]* 1.1 Write unit tests for window splitting and metric helpers
    - Test `splitWindow` with 3 rows (error), 4 rows (2+2), 5 rows (2+3), 6 rows (3+3)
    - Test `computeAvg` with all-null rows, mixed null/number rows
    - Test `computeChangePct` with zero baseline, positive and negative changes
    - Test `classifySeverity` at boundary values (0.29, 0.3, 0.49, 0.5)
    - // Feature: creative-intelligence-engine, Property 2: Baseline/recent split is exhaustive and non-overlapping
    - // Feature: creative-intelligence-engine, Property 3: change_pct formula identity
    - // Feature: creative-intelligence-engine, Property 4: Severity classification covers all change_pct values
    - _Requirements: 1.4, 1.5, 2.1, 2.2, 2.3, 3.8_

- [x] 2. Implement root-cause classification in `src/intelligence.js`
  - Implement `classifyRootCauses(baseline, recent, options)` — evaluates all 7 root-cause signal patterns against the baseline and recent period row arrays; returns an array of `{ root_cause, metric, plain_english_explanation, recommended_action }` objects
  - Signal logic:
    - `auction_pressure`: CPM change_pct > 0.2 AND |CTR change_pct| <= 0.1
    - `creative_fatigue`: frequency change_pct > 0 AND CTR change_pct < 0
    - `tracking_break`: recent spend avg > `minimum_spend_to_judge` AND recent purchases avg < 0.5
    - `learning_phase_reset`: coefficient of variation of daily ROAS across all rows > 0.4 (stddev / mean)
    - `audience_saturation`: reach change_pct < 0 AND frequency change_pct > 0
    - `offer_mismatch`: recent CTR avg > 1.5 AND recent purchase_rate avg (purchases/clicks) < 0.02
    - `budget_pacing`: `monthly_budget` provided AND `|projected_spend - monthly_budget| / monthly_budget > 0.15`
  - Each root cause entry must include a non-empty `plain_english_explanation` and `recommended_action` string
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.9, 3.10_

  - [ ]* 2.1 Write property tests for each root-cause signal
    - For each of the 7 root causes, construct rows that satisfy the signal conditions and assert the root cause appears in the output
    - Construct rows that do NOT satisfy each signal and assert the root cause is absent
    - Assert every returned root-cause entry has non-empty `plain_english_explanation` and `recommended_action`
    - // Feature: creative-intelligence-engine, Property 5: Root-cause signals are mutually independent
    - _Requirements: 3.1–3.10_

- [x] 3. Implement `detectAnomalies` export in `src/intelligence.js`
  - Implement `detectAnomalies(rows, options)` — orchestrates `splitWindow`, per-metric `computeAvg` + `computeChangePct`, threshold filtering, `classifySeverity`, and `classifyRootCauses`; returns `{ anomalies, summary }`
  - Evaluate deviations for: `spend`, `cpm`, `ctr`, `roas`, `cost_per_purchase`, `frequency`, `reach`, `purchases`
  - Each anomaly entry shape: `{ metric, baseline_avg, recent_avg, change_pct, root_cause, plain_english_explanation, recommended_action, severity }`
  - When no anomalies: return `{ anomalies: [], summary: "No significant anomalies detected in the selected window." }`
  - _Requirements: 2.4, 2.5, 4.3, 4.4_

  - [ ]* 3.1 Write property tests for detectAnomalies
    - Property: lowering threshold never produces fewer anomalies than a higher threshold on the same rows
    - Property: every anomaly entry contains all required fields (metric, baseline_avg, recent_avg, change_pct, root_cause, plain_english_explanation, recommended_action, severity)
    - Edge case: rows with zero baseline metric — no anomaly emitted for that metric
    - Edge case: fewer than 4 rows — returns error
    - // Feature: creative-intelligence-engine, Property 1: Anomaly threshold monotonicity
    - _Requirements: 2.4, 4.3, 4.4_

- [x] 4. Implement creative brief functions in `src/intelligence.js`
  - Implement `inferHookType(adName)` — keyword pattern matching on lowercased `adName`; maps `ugc`, `testimonial`, `demo`, `problem`, `question`, `stat` to corresponding hook type strings; returns `"unknown"` for unrecognized names
  - Implement `selectTopAds(rows, topN)` — filters rows by `spend >= minimum_spend_to_judge`, sorts by `roas` descending, slices to `Math.min(topN, 10)`, maps each to `AdSummary` shape including `hook_type` from `inferHookType`
  - Implement `buildCreativeBrief(topAds, brandContext)` — constructs the full `CreativeBrief` object: `winning_pattern` string referencing actual CTR/ROAS/CPA values, `brief` array of exactly 3 variation directions, static `meta_specs`, `skill_context` referencing `["ad-creative", "100m-offers"]`, and `production_checklist`
  - When `brandContext` is provided, incorporate it into `winning_pattern` and each variation's `copy_direction`
  - _Requirements: 5.2, 5.4, 5.6, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

  - [ ]* 4.1 Write property and unit tests for creative brief functions
    - Property: `selectTopAds` with topN > 10 returns at most 10 ads
    - Property: `selectTopAds` returns ads in descending ROAS order for any input set
    - Property: `buildCreativeBrief` always returns `brief` array of length exactly 3
    - Property: `production_checklist` is always a non-empty string array
    - Property: when `brandContext` is provided, it appears in `winning_pattern`
    - Unit: `inferHookType` maps each recognized keyword correctly; unrecognized → `"unknown"`
    - Unit: `meta_specs` contains correct character limits (125, 40, 30) and all 4 format strings
    - Unit: `skill_context.skills` contains both `"ad-creative"` and `"100m-offers"`
    - // Feature: creative-intelligence-engine, Property 6: top_n cap
    - // Feature: creative-intelligence-engine, Property 7: Top ads sorted by ROAS descending
    - // Feature: creative-intelligence-engine, Property 8: Brief always contains exactly 3 variation directions
    - _Requirements: 5.2, 5.4, 6.1, 6.3, 6.4, 6.5, 6.6, 6.7_

- [x] 5. Implement `computeSpendPacing` export in `src/intelligence.js`
  - Implement `computeSpendPacing(rows, options)` where `options = { monthly_budget, gross_margin_pct, target_roas, referenceDate }`
  - Derive `days_elapsed` from the number of distinct date rows; derive `days_remaining` from the calendar month boundary (or `time_range` end) minus the last row date
  - Compute: `avg_daily_spend`, `projected_month_spend`, `budget_remaining`, `recommended_daily_budget` (0 when `days_remaining = 0`), `breakeven_roas = 1 / gross_margin_pct`
  - Compute `projected_profit_loss` when ROAS data is available: `(projected_month_spend × current_roas × gross_margin_pct) - projected_month_spend`
  - Classify `pacing_status`: `at_risk` when `spend_to_date > monthly_budget`; `overpacing` when projected > budget × 1.1; `underpacing` when projected < budget × 0.9; `on_track` otherwise
  - Set `cash_flow_warning` to a plain-English string when `pacing_status` is `overpacing` or `at_risk`; `null` otherwise
  - _Requirements: 8.1–8.10_

  - [ ]* 5.1 Write property tests for computeSpendPacing
    - Property: `projected_month_spend = avg_daily_spend × (days_elapsed + days_remaining)` for any rows where `days_remaining > 0`
    - Property: `budget_remaining = monthly_budget - spend_to_date` always
    - Property: `recommended_daily_budget = budget_remaining / days_remaining` when `days_remaining > 0`
    - Property: `breakeven_roas = 1 / gross_margin_pct` for any valid `gross_margin_pct`
    - Property: when `spend_to_date > monthly_budget`, `pacing_status = "at_risk"`
    - Property: `cash_flow_warning` is null when `pacing_status` is `"on_track"` or `"underpacing"`
    - Edge case: `days_remaining = 0` → `recommended_daily_budget = 0`
    - // Feature: creative-intelligence-engine, Property 9: Pacing projection identity
    - // Feature: creative-intelligence-engine, Property 10: budget_remaining invariant
    - // Feature: creative-intelligence-engine, Property 11: recommended_daily_budget identity
    - // Feature: creative-intelligence-engine, Property 12: breakeven_roas identity
    - // Feature: creative-intelligence-engine, Property 13: at_risk when overspent
    - // Feature: creative-intelligence-engine, Property 14: cash_flow_warning is null when on_track or underpacing
    - _Requirements: 8.1–8.10_

- [ ] 6. Checkpoint — Ensure all intelligence.js tests pass
  - Run `npm test` from `meta-ads-agency-harness/meta-ads-mcp/`
  - All existing 27 tests must still pass
  - All new `intelligence.test.js` tests must pass
  - Ask the user if any questions arise before proceeding

- [-] 7. Add `detectAnomalies` method to `src/metaClient.js`
  - Import `detectAnomalies` from `./intelligence.js`
  - Add `async detectAnomalies(input)` method to `MetaAdsClient`:
    - Validate `level` is `"campaign"` or `"adset"`; return `toolError` otherwise
    - Call `this.getDailyPerformance({ ...input, level, time_increment: 1 })` (defaulting to `date_preset: "last_14d"` when no date param provided)
    - Pass `response.rows` and `{ anomaly_threshold, monthly_budget, minimum_spend_to_judge }` to `intelligence.detectAnomalies()`
    - Return the result or propagate the error
  - _Requirements: 1.1, 1.2, 1.3, 4.5_

- [-] 8. Add `generateCreativeBrief` method to `src/metaClient.js`
  - Import `selectTopAds` and `buildCreativeBrief` from `./intelligence.js`
  - Add `async generateCreativeBrief(input)` method to `MetaAdsClient`:
    - Validate that at least one of `ad_id`, `adset_id`, `campaign_id` is provided; return `toolError` otherwise
    - When `ad_id` provided: call `this.getAdInsights({ ...input, level: "ad" })` and use the single matching row
    - When `adset_id` or `campaign_id` provided: call `this.getAdInsights({ ...input, level: "ad", adset_id or campaign_id })` to get all ads in scope
    - Pass rows to `selectTopAds(rows, input.top_n ?? 3)` — return `toolError` if result is empty
    - Pass top ads and `input.brand_context` to `buildCreativeBrief()`
    - Return `{ winning_ads, winning_pattern, brief, meta_specs, skill_context, production_checklist }`
  - _Requirements: 5.1, 5.2, 5.3, 5.5, 7.4, 7.5_

- [ ] 9. Add `getSpendPacing` method to `src/metaClient.js`
  - Import `computeSpendPacing` from `./intelligence.js`
  - Add `async getSpendPacing(input)` method to `MetaAdsClient`:
    - Validate `monthly_budget` is a positive number; return `toolError` otherwise
    - Validate `gross_margin_pct` is in range (0, 1]; return `toolError` otherwise
    - Default `time_range` to current calendar month when not provided
    - Call `this.getDailyPerformance({ ...input, level: "account", time_increment: 1 })`
    - Pass `response.rows` and `{ monthly_budget, gross_margin_pct, target_roas }` to `computeSpendPacing()`
    - Return the pacing result or propagate the error
  - _Requirements: 8.1, 9.4, 9.5, 9.6_

- [ ] 10. Register three new tools in `src/server.js`
  - Add `detect_anomalies` tool entry using the `tool()` helper with schema:
    - `date_preset` (string, optional), `time_range` (object, optional, same shape as `reportSchema()`), `level` (enum `["campaign","adset"]`, optional), `entity_id` (string, optional), `anomaly_threshold` (number, optional), `monthly_budget` (number, optional), `minimum_spend_to_judge` (number, optional)
    - `additionalProperties: false`
  - Add `generate_creative_brief` tool entry:
    - `ad_id` (string, optional), `adset_id` (string, optional), `campaign_id` (string, optional), `date_preset` (string, optional), `top_n` (number, optional), `brand_context` (string, optional)
    - `additionalProperties: false`
  - Add `get_spend_pacing` tool entry:
    - `monthly_budget` (number, required), `gross_margin_pct` (number, required), `target_roas` (number, optional), `time_range` (object, optional)
    - `additionalProperties: false`
  - Add the three handlers to `toolHandlers`: `detect_anomalies`, `generate_creative_brief`, `get_spend_pacing`
  - _Requirements: 4.1, 4.2, 7.1, 7.2, 9.1, 9.2_

- [ ] 11. Checkpoint — Ensure all tests pass and server syntax is valid
  - Run `npm run check` to verify no syntax errors in server.js and metaClient.js
  - Run `npm test` — all tests must pass
  - Ask the user if any questions arise before proceeding

- [x] 12. Install ad-creative skill
  - Create `meta-ads-agency-harness/skills/ad-creative-skill/SKILL.md`
  - Write skill front-matter with `name: ad-creative` and a trigger description covering ad copy, hooks, creative briefs, and Meta ad formats
  - Write skill body covering: hook frameworks (pattern interrupt, question, stat, testimonial, problem-agitate-solve), Meta placement specs, copy structure (hook → body → CTA), visual direction principles, and a creative review checklist
  - Follow the same format as `100m-offers-skill/SKILL.md`
  - _Requirements: 11.1, 11.2, 11.3_

- [x] 13. Create Creative Intelligence Workflow document
  - Create `meta-ads-agency-harness/harness/CREATIVE_INTELLIGENCE_WORKFLOW.md`
  - Document the recommended three-step sequence: (1) `detect_anomalies` to identify problem entities, (2) `generate_creative_brief` for flagged entities, (3) `get_spend_pacing` for budget context
  - Include example tool calls with representative input parameters for each tool
  - Explain when to invoke the `ad-creative` skill (during brief execution) and the `100m-offers` skill (when offer_mismatch anomaly is detected)
  - _Requirements: 12.1, 12.2, 12.3, 12.4_

- [ ] 14. Final checkpoint — Ensure all tests pass
  - Run `npm test` from `meta-ads-agency-harness/meta-ads-mcp/`
  - Confirm all 27 original tests still pass alongside all new tests
  - Ask the user if any questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- All pure functions in `intelligence.js` must have no imports from `metaClient.js` or `config.js`
- The existing Jest config discovers `*.test.js` automatically — no config changes needed
- `minimum_spend_to_judge` defaults to `1500` consistent with `DEFAULT_MINIMUM_SPEND_TO_JUDGE` in `metaClient.js`
- Property tests use `test.each` with generated input arrays — no new test dependencies required
