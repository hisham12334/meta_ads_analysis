# Requirements Document

## Introduction

The Market Intelligence Tool is a set of MCP tools added to the existing Meta Ads MCP server that enables an agency or brand owner to analyse the competitive landscape in a given niche or category **before** writing ads or crafting offers. It queries the Meta Ad Library API for publicly visible competitor ads, extracts performance signals (run duration, platforms, impression ranges), classifies ads into top-performing and low-performing buckets, and returns structured intelligence that feeds directly into the Creative Intelligence Workflow and the Offer Strategy Workflow.

The tool is read-only and produces no changes to any live ad account.

## Glossary

- **Ad_Library_Client**: The module responsible for querying the Meta Ad Library API.
- **Market_Analyzer**: The pure-function module that classifies, scores, and summarises competitor ad data.
- **Intelligence_Report**: The structured JSON object returned to the caller containing competitive signals, pattern analysis, and workflow context.
- **Ad_Library_Ad**: A single ad record returned by the Meta Ad Library API, containing creative metadata, run dates, platforms, and impression range.
- **Niche**: A keyword, category, or search term used to scope the Ad Library query (e.g. "eco-friendly water bottles", "skincare for moms").
- **Run_Duration**: The number of days an ad has been continuously active, computed from `ad_delivery_start_time` to today or `ad_delivery_stop_time`.
- **Impression_Range**: The estimated impression bucket returned by the Meta Ad Library (e.g. "1K–5K", "10K–50K").
- **Hook_Signal**: A short label classifying the opening angle of an ad's primary text (e.g. `question`, `stat_hook`, `problem_agitate`, `testimonial`, `ugc`, `demo`, `founder_story`).
- **Format_Signal**: The creative format of an ad as reported by the Meta Ad Library (e.g. `image`, `video`, `carousel`).
- **Offer_Signal**: A label classifying the offer type inferred from ad copy (e.g. `discount`, `free_trial`, `bundle`, `guarantee`, `scarcity`, `none_detected`).
- **CTA_Signal**: The call-to-action label extracted from the ad (e.g. `Shop Now`, `Learn More`, `Sign Up`).
- **Top_Performer**: An ad classified as high-signal based on long run duration and high impression range.
- **Low_Performer**: An ad classified as low-signal based on short run duration and low impression range.
- **Country_Code**: An ISO 3166-1 alpha-2 country code used to scope the Ad Library search (e.g. `US`, `GB`, `IN`).

## Requirements

### Requirement 1: Query the Meta Ad Library

**User Story:** As a brand owner or agency strategist, I want to search the Meta Ad Library for active competitor ads in a specific niche, so that I can see what is currently running in my market.

#### Acceptance Criteria

1. WHEN a caller invokes `search_ad_library` with a `query` string, THE Ad_Library_Client SHALL request active ads from the Meta Ad Library API matching that query.
2. WHEN a `country` parameter is provided, THE Ad_Library_Client SHALL scope the search to that country; IF no `country` is provided, THEN THE Ad_Library_Client SHALL default to `US`.
3. WHEN a `limit` parameter is provided, THE Ad_Library_Client SHALL return at most that many ad records; IF no `limit` is provided, THEN THE Ad_Library_Client SHALL default to 50 records.
4. WHEN the Meta Ad Library API returns a successful response, THE Ad_Library_Client SHALL return the raw ad records for downstream processing.
5. IF the Meta Ad Library API returns an error, THEN THE Ad_Library_Client SHALL return a structured error object with `type`, `message`, and `retryable` fields, consistent with the existing error format used by the MCP server.
6. IF the `query` parameter is an empty string or contains only whitespace, THEN THE Ad_Library_Client SHALL return a structured error with `type: "invalid_input"` and `retryable: false` without making a network request.

---

### Requirement 2: Extract Performance Signals from Ad Records

**User Story:** As a strategist, I want each competitor ad to be enriched with performance signals like run duration, impression range, platforms, hook type, format, offer type, and CTA, so that I can quickly assess which ads are likely working.

#### Acceptance Criteria

1. WHEN an Ad_Library_Ad record is processed, THE Market_Analyzer SHALL compute the Run_Duration in days from `ad_delivery_start_time` to the current date or `ad_delivery_stop_time`, whichever is earlier.
2. WHEN an Ad_Library_Ad record is processed, THE Market_Analyzer SHALL extract the Impression_Range label directly from the ad record's impression data field.
3. WHEN an Ad_Library_Ad record is processed, THE Market_Analyzer SHALL extract the list of publisher platforms from the ad record.
4. WHEN an Ad_Library_Ad record is processed, THE Market_Analyzer SHALL infer the Hook_Signal from the ad's primary text using keyword pattern matching consistent with the existing `inferHookType` logic in `intelligence.js`.
5. WHEN an Ad_Library_Ad record is processed, THE Market_Analyzer SHALL extract the Format_Signal from the ad record's creative type field.
6. WHEN an Ad_Library_Ad record is processed, THE Market_Analyzer SHALL infer the Offer_Signal from the ad's primary text using keyword pattern matching for discount, free trial, bundle, guarantee, and scarcity language.
7. WHEN an Ad_Library_Ad record is processed, THE Market_Analyzer SHALL extract the CTA_Signal from the ad record's call-to-action field.
8. IF any signal field is absent or cannot be inferred, THEN THE Market_Analyzer SHALL set that field to `null` rather than omitting it or throwing an error.

---

### Requirement 3: Classify Ads into Performance Tiers

**User Story:** As a strategist, I want ads automatically sorted into top-performing and low-performing buckets, so that I can focus my analysis on what is working and what is not.

#### Acceptance Criteria

1. THE Market_Analyzer SHALL classify each enriched ad as a Top_Performer, Low_Performer, or `unclassified` based on a composite score derived from Run_Duration and Impression_Range.
2. WHEN computing the composite score, THE Market_Analyzer SHALL assign a higher score to longer Run_Duration values and higher Impression_Range buckets.
3. WHEN the composite score is in the top tercile of all scored ads in the result set, THE Market_Analyzer SHALL classify the ad as a Top_Performer.
4. WHEN the composite score is in the bottom tercile of all scored ads in the result set, THE Market_Analyzer SHALL classify the ad as a Low_Performer.
5. WHEN the composite score is in the middle tercile, THE Market_Analyzer SHALL classify the ad as `unclassified`.
6. IF fewer than 3 ads are present in the result set, THEN THE Market_Analyzer SHALL classify all ads as `unclassified` rather than applying tercile logic.

---

### Requirement 4: Analyse Patterns Across Performance Tiers

**User Story:** As a strategist, I want a summary of which hooks, formats, offer types, and CTAs appear most in top-performing vs low-performing ads, so that I can understand what creative patterns are winning in my market.

#### Acceptance Criteria

1. WHEN an Intelligence_Report is generated, THE Market_Analyzer SHALL compute the frequency of each Hook_Signal value among Top_Performer ads and among Low_Performer ads separately.
2. WHEN an Intelligence_Report is generated, THE Market_Analyzer SHALL compute the frequency of each Format_Signal value among Top_Performer ads and among Low_Performer ads separately.
3. WHEN an Intelligence_Report is generated, THE Market_Analyzer SHALL compute the frequency of each Offer_Signal value among Top_Performer ads and among Low_Performer ads separately.
4. WHEN an Intelligence_Report is generated, THE Market_Analyzer SHALL compute the frequency of each CTA_Signal value among Top_Performer ads and among Low_Performer ads separately.
5. WHEN an Intelligence_Report is generated, THE Market_Analyzer SHALL compute the average Run_Duration for Top_Performer ads and for Low_Performer ads separately.
6. IF a tier contains zero ads, THEN THE Market_Analyzer SHALL return empty frequency maps and `null` for average run duration for that tier rather than omitting the tier from the report.

---

### Requirement 5: Return a Structured Intelligence Report

**User Story:** As a strategist, I want the tool to return a single structured report I can pass directly into the Creative Intelligence Workflow and Offer Strategy Workflow, so that market context automatically informs my ad creative and offer decisions.

#### Acceptance Criteria

1. THE Market_Analyzer SHALL return an Intelligence_Report containing: `query`, `country`, `total_ads_analysed`, `top_performers`, `low_performers`, `unclassified`, `pattern_analysis`, and `workflow_context` fields.
2. THE `pattern_analysis` field SHALL contain `top_performer_patterns` and `low_performer_patterns`, each with `hook_frequencies`, `format_frequencies`, `offer_frequencies`, `cta_frequencies`, and `avg_run_duration_days`.
3. THE `workflow_context` field SHALL contain a `creative_brief_hint` string summarising the dominant hook and format among top performers, and an `offer_strategy_hint` string summarising the dominant offer signal among top performers.
4. WHEN no ads are returned by the Ad Library query, THE Market_Analyzer SHALL return an Intelligence_Report with `total_ads_analysed: 0`, empty tier arrays, empty pattern maps, and a `workflow_context` noting that no competitor data was found.
5. THE Intelligence_Report SHALL be serialisable to JSON without loss of information.

---

### Requirement 6: Expose the Tool via the MCP Server

**User Story:** As a developer integrating this into the agency harness, I want the market intelligence capability exposed as one or more MCP tools on the existing server, so that any MCP-compatible agent can call it without additional setup.

#### Acceptance Criteria

1. THE MCP_Server SHALL register a tool named `search_ad_library` with an input schema accepting `query` (required string), `country` (optional string, default `US`), `limit` (optional number, default 50, max 200), and `ad_type` (optional string, default `ALL`).
2. WHEN `search_ad_library` is called, THE MCP_Server SHALL invoke the Ad_Library_Client and Market_Analyzer pipeline and return the Intelligence_Report as the tool result.
3. THE MCP_Server SHALL register a tool named `analyse_market` that accepts `query` (required string), `country` (optional string), `limit` (optional number), `ad_type` (optional string), and `brand_context` (optional string for injecting into workflow hints).
4. WHEN `analyse_market` is called, THE MCP_Server SHALL invoke the full pipeline and return an Intelligence_Report enriched with brand-context-aware workflow hints when `brand_context` is provided.
5. IF a tool handler throws an unhandled exception, THEN THE MCP_Server SHALL return a JSON-RPC error response with code `-32603` and the exception message, consistent with the existing error handling pattern in `server.js`.

---

### Requirement 7: Handle API Rate Limits and Errors Gracefully

**User Story:** As a developer, I want the tool to handle Meta Ad Library API errors and rate limits without crashing the MCP server, so that a failed market intelligence call does not disrupt other tools.

#### Acceptance Criteria

1. IF the Meta Ad Library API returns HTTP 429 or a rate-limit error code, THEN THE Ad_Library_Client SHALL return a structured error with `type: "rate_limit"` and `retryable: true`.
2. IF the Meta Ad Library API returns HTTP 401 or 403, THEN THE Ad_Library_Client SHALL return a structured error with `type: "auth_error"` or `type: "permission_error"` and `retryable: false`.
3. IF a network request to the Meta Ad Library API fails due to a connectivity issue, THEN THE Ad_Library_Client SHALL return a structured error with `type: "network_error"` and `retryable: true`.
4. WHEN a structured error is returned by the Ad_Library_Client, THE MCP_Server SHALL surface it as the tool result with `isError: true`, consistent with the existing error surfacing pattern in `server.js`.
