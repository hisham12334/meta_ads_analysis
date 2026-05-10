# Implementation Plan: Market Intelligence Tool

## Overview

Add `search_ad_library` and `analyse_market` MCP tools to the existing server by implementing three focused modules: a pure-function analysis module (`marketIntelligence.js`), a Meta Ad Library API client (`adLibraryClient.js`), and wiring both into `metaClient.js` and `server.js`.

## Tasks

- [x] 1. Implement the pure-function Market Intelligence analysis module
  - Create `src/marketIntelligence.js` with no network calls and no imports from `metaClient` or `config`
  - Implement `computeRunDuration(startDate, stopDate, referenceDate)` — returns days as a non-negative number or null
  - Implement `scoreImpressionRange(impressions)` — maps `{ lower_bound, upper_bound }` to a 0–5 ordinal score using the table in the design
  - Implement `inferOfferSignal(text)` — keyword pattern matching returning one of: `discount`, `free_trial`, `bundle`, `guarantee`, `scarcity`, `none_detected`
  - Implement `enrichAd(rawAd, referenceDate)` — returns an `EnrichedAd` with all signal fields present (never `undefined`); reuse `inferHookType` from `intelligence.js`
  - Implement `computeFrequencies(ads, field)` — returns a `Record<string, number>` frequency map
  - Implement `classifyTiers(enrichedAds)` — applies composite score formula and tercile logic; returns `{ top, low, unclassified }`; all ads unclassified when fewer than 3
  - Implement `buildIntelligenceReport(enrichedAds, query, country, brandContext)` — assembles the full `Intelligence_Report` shape including `workflow_context` hints
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 2. Write tests for the analysis module
  - [x]* 2.1 Write property test: run duration is non-negative
    - Install `fast-check` as a dev dependency: `npm install --save-dev fast-check`
    - Generate random date pairs where start ≤ reference; assert `computeRunDuration` ≥ 0
    - `// Feature: market-intelligence-tool, Property 1: run duration is non-negative`
    - **Validates: Requirements 2.1**
  - [x]* 2.2 Write property test: enriched ad signal fields are never undefined
    - Generate arbitrary raw ad records with random missing/null fields; assert all signal fields are present in the result
    - `// Feature: market-intelligence-tool, Property 2: enriched ad signal fields are never undefined`
    - **Validates: Requirements 2.8**
  - [x]* 2.3 Write property test: tier classification covers all ads
    - Generate random arrays of enriched ads; assert `top + low + unclassified` length equals input length
    - `// Feature: market-intelligence-tool, Property 3: tier classification covers all ads`
    - **Validates: Requirements 3.1, 3.3, 3.4, 3.5**
  - [x]* 2.4 Write property test: small result sets are all unclassified
    - Generate arrays of 0–2 enriched ads; assert `top_performers` and `low_performers` are both empty
    - `// Feature: market-intelligence-tool, Property 4: small result sets are all unclassified`
    - **Validates: Requirements 3.6**
  - [x]* 2.5 Write property test: frequency maps sum to tier size
    - Generate random ad arrays (≥ 3); assert sum of all frequency values equals tier length for each signal field
    - `// Feature: market-intelligence-tool, Property 5: frequency maps sum to tier size`
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
  - [x]* 2.6 Write property test: Intelligence Report is JSON round-trippable
    - Generate random ad arrays; assert `JSON.parse(JSON.stringify(report))` deeply equals original
    - `// Feature: market-intelligence-tool, Property 6: Intelligence Report is JSON round-trippable`
    - **Validates: Requirements 5.5**
  - [x]* 2.7 Write property test: composite score ordering consistent with tier
    - Generate random arrays of ≥ 3 ads; assert min composite score of top performers ≥ max composite score of low performers
    - `// Feature: market-intelligence-tool, Property 8: composite score ordering consistent with tier`
    - **Validates: Requirements 3.2, 3.3, 3.4**
  - [x]* 2.8 Write unit tests for edge cases
    - `computeRunDuration` with start = reference date → 0
    - `computeRunDuration` with a past stop date → uses stop date
    - `scoreImpressionRange` with null impressions → 0
    - `inferOfferSignal` with text containing multiple signal keywords → returns first match
    - `enrichAd` with a fully null raw record → all signal fields present
    - `classifyTiers` with exactly 2 ads → all `unclassified`
    - `buildIntelligenceReport` with 0 ads → correct empty report shape with `total_ads_analysed: 0`
    - _Requirements: 2.1, 2.8, 3.6, 5.4_

- [x] 3. Checkpoint — ensure all analysis module tests pass
  - Run `npm test -- --testPathPattern=marketIntelligence` and confirm all tests pass; ask the user if questions arise.

- [x] 4. Implement the Ad Library API client
  - Create `src/adLibraryClient.js`
  - Implement `searchAdLibrary(params, config)` — builds the Ad Library API URL with the fields listed in the design, applies defaults (`country: "US"`, `limit: 50`, `ad_type: "ALL"`), clamps limit to 200
  - Validate that `query` is non-empty/non-whitespace before making any network request; return `{ error: { type: "invalid_input", ... } }` immediately if invalid
  - Map HTTP 401/403 → `auth_error`/`permission_error`, HTTP 429 or rate-limit codes → `rate_limit`, network failures → `network_error`, following the same `normalizeMetaError` pattern in `metaClient.js`
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 7.1, 7.2, 7.3_
  - [x]* 4.1 Write unit tests for the Ad Library client
    - Whitespace query → `invalid_input` error, no fetch called (Property 7)
    - `// Feature: market-intelligence-tool, Property 7: whitespace query rejected without network call`
    - Successful response → returns `{ ads: [...] }`
    - HTTP 429 → `{ error: { type: "rate_limit", retryable: true } }`
    - HTTP 403 → `{ error: { type: "permission_error", retryable: false } }`
    - Network failure → `{ error: { type: "network_error", retryable: true } }`
    - Default country/limit applied when not provided
    - _Requirements: 1.2, 1.3, 1.5, 1.6, 7.1, 7.2, 7.3_

- [x] 5. Wire the pipeline into MetaAdsClient and register MCP tools
  - Add `searchAdLibraryAndAnalyse(input)` method to `MetaAdsClient` in `metaClient.js`:
    - Calls `searchAdLibrary(input, this.config)` from `adLibraryClient.js`
    - On error, returns the error object directly
    - On success, calls `enrichAd` on each raw ad, then `buildIntelligenceReport`
  - Add `analyseMarket(input)` method to `MetaAdsClient` — same pipeline, passes `input.brand_context` to `buildIntelligenceReport`
  - Add `search_ad_library` tool definition to the `tools` array in `server.js` with schema: `query` (required string), `country` (optional string), `limit` (optional number, min 1, max 200), `ad_type` (optional string)
  - Add `analyse_market` tool definition with the same schema plus `brand_context` (optional string)
  - Add `search_ad_library` and `analyse_market` entries to `toolHandlers` in `server.js`
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  - [x]* 5.1 Write integration tests for the wired pipeline
    - Mock `searchAdLibrary` to return a fixed set of raw ads; assert the tool result contains a valid `Intelligence_Report` shape
    - Mock `searchAdLibrary` to return an error; assert the tool result has `isError: true`
    - _Requirements: 6.2, 6.4, 6.5_

- [x] 6. Final checkpoint — ensure all tests pass
  - Run `npm test` and confirm the full test suite passes; ask the user if questions arise.
