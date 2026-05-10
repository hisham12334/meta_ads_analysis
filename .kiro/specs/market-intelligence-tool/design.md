# Design Document: Market Intelligence Tool

## Overview

The Market Intelligence Tool adds two MCP tools — `search_ad_library` and `analyse_market` — to the existing Meta Ads MCP server. Both tools query the Meta Ad Library API for publicly visible competitor ads in a given niche, enrich each ad with performance signals, classify ads into performance tiers, and return a structured Intelligence Report that feeds directly into the Creative Intelligence Workflow and Offer Strategy Workflow.

The implementation follows the same architectural pattern already established in the codebase:

- **Pure-function analysis module** (`src/marketIntelligence.js`) — no network calls, fully testable
- **API client extension** (`src/adLibraryClient.js`) — handles Meta Ad Library HTTP requests and error normalisation
- **Server registration** (`src/server.js`) — adds tool definitions and handlers

The tool is read-only. It makes no changes to any live ad account.

---

## Architecture

```mermaid
flowchart TD
    A[MCP Client / Agent] -->|tools/call search_ad_library\nor analyse_market| B[server.js]
    B --> C[adLibraryClient.js\nsearchAdLibrary]
    C -->|GET /ads_archive| D[Meta Ad Library API]
    D -->|raw ad records| C
    C -->|Ad_Library_Ad[]| B
    B --> E[marketIntelligence.js\nenrichAds + classifyTiers\n+ analysePatterns + buildReport]
    E -->|Intelligence_Report| B
    B -->|JSON tool result| A
```

The server orchestrates the pipeline. The client handles all network concerns. The intelligence module handles all analysis concerns. This mirrors the existing split between `metaClient.js` and `intelligence.js`.

---

## Components and Interfaces

### adLibraryClient.js

Responsible for all HTTP communication with the Meta Ad Library API.

```js
/**
 * Search the Meta Ad Library for active ads matching a query.
 *
 * @param {object} params
 * @param {string} params.query          - Search keyword or niche
 * @param {string} [params.country]      - ISO country code, default "US"
 * @param {number} [params.limit]        - Max records to return, default 50, max 200
 * @param {string} [params.ad_type]      - "ALL" | "POLITICAL_AND_ISSUE_ADS", default "ALL"
 * @param {object} config                - Loaded config (accessToken, graphBaseUrl)
 * @returns {Promise<{ ads: RawAd[] } | { error: ErrorObject }>}
 */
export async function searchAdLibrary(params, config)
```

Fields requested from the Ad Library API per ad record:

```
id
ad_creative_bodies
ad_creative_link_captions
ad_creative_link_descriptions
ad_creative_link_titles
ad_delivery_start_time
ad_delivery_stop_time
ad_snapshot_url
bylines
currency
delivery_by_region
demographic_distribution
estimated_audience_size
impressions
page_id
page_name
publisher_platforms
spend
ad_creative_media_type
```

### marketIntelligence.js

Pure functions only. No network calls. Mirrors the style of `intelligence.js`.

```js
/** Compute run duration in days from start date to end date or today */
export function computeRunDuration(startDate, stopDate, referenceDate)

/** Map impression range string to a numeric score (0–5) */
export function scoreImpressionRange(impressionRange)

/** Infer offer signal from ad body text */
export function inferOfferSignal(text)

/** Enrich a single raw Ad Library ad with computed signals */
export function enrichAd(rawAd, referenceDate)

/** Classify enriched ads into top/low/unclassified tiers */
export function classifyTiers(enrichedAds)

/** Compute frequency map for a signal field across an array of ads */
export function computeFrequencies(ads, field)

/** Analyse patterns across tiers and build the full Intelligence Report */
export function buildIntelligenceReport(enrichedAds, query, country, brandContext)
```

### server.js changes

Two new tool definitions added to the `tools` array:

- `search_ad_library` — raw search + enrichment + classification + report
- `analyse_market` — same pipeline with optional `brand_context` for richer workflow hints

Two new handler entries added to `toolHandlers`:

```js
search_ad_library: (args) => client.searchAdLibraryAndAnalyse(args),
analyse_market:    (args) => client.analyseMarket(args),
```

### metaClient.js changes

Two new methods added to `MetaAdsClient`:

```js
async searchAdLibraryAndAnalyse(input)
async analyseMarket(input)
```

Both methods call `searchAdLibrary` from `adLibraryClient.js`, then pass results through `buildIntelligenceReport` from `marketIntelligence.js`.

---

## Data Models

### RawAd (from Meta Ad Library API)

```js
{
  id: string,
  ad_creative_bodies: string[],          // primary text variants
  ad_creative_link_titles: string[],     // headline variants
  ad_delivery_start_time: string,        // ISO date string
  ad_delivery_stop_time: string | null,  // ISO date string or null if still active
  impressions: { lower_bound: string, upper_bound: string } | null,
  publisher_platforms: string[],         // ["facebook", "instagram", ...]
  ad_creative_media_type: string | null, // "IMAGE" | "VIDEO" | "DCO" | null
  page_name: string,
  page_id: string,
  ad_snapshot_url: string
}
```

### EnrichedAd

```js
{
  id: string,
  page_name: string,
  page_id: string,
  ad_snapshot_url: string,
  primary_text: string | null,           // first body variant
  headline: string | null,               // first title variant
  run_duration_days: number | null,
  impression_range: string | null,       // e.g. "1000-4999"
  publisher_platforms: string[],
  hook_signal: string,                   // from inferHookType (intelligence.js)
  format_signal: string | null,          // "image" | "video" | "carousel" | null
  offer_signal: string,                  // from inferOfferSignal
  cta_signal: string | null,
  performance_tier: "top" | "low" | "unclassified",
  composite_score: number
}
```

### Intelligence_Report

```js
{
  query: string,
  country: string,
  total_ads_analysed: number,
  top_performers: EnrichedAd[],
  low_performers: EnrichedAd[],
  unclassified: EnrichedAd[],
  pattern_analysis: {
    top_performer_patterns: TierPatterns,
    low_performer_patterns: TierPatterns
  },
  workflow_context: {
    creative_brief_hint: string,
    offer_strategy_hint: string
  }
}

// TierPatterns
{
  hook_frequencies: Record<string, number>,
  format_frequencies: Record<string, number>,
  offer_frequencies: Record<string, number>,
  cta_frequencies: Record<string, number>,
  avg_run_duration_days: number | null
}
```

### Impression Range Scoring

The Meta Ad Library returns impression ranges as objects with `lower_bound` and `upper_bound` string fields. The scorer maps these to a 0–5 ordinal scale:

| lower_bound | Score |
|---|---|
| < 1 000 | 0 |
| 1 000 – 4 999 | 1 |
| 5 000 – 9 999 | 2 |
| 10 000 – 49 999 | 3 |
| 50 000 – 99 999 | 4 |
| ≥ 100 000 | 5 |

### Composite Score Formula

```
composite_score = (run_duration_days / 30) + impression_score * 2
```

Run duration is normalised to a 30-day unit so that a 30-day run contributes 1.0 to the score. Impression score is weighted 2× because impression range is a stronger signal of ad effectiveness than raw longevity.

### Offer Signal Keywords

| Signal | Keywords |
|---|---|
| `discount` | "% off", "save", "discount", "sale", "deal", "promo" |
| `free_trial` | "free trial", "try free", "free for", "no cost" |
| `bundle` | "bundle", "pack", "kit", "combo", "set of" |
| `guarantee` | "guarantee", "money back", "risk free", "risk-free", "refund" |
| `scarcity` | "limited", "only X left", "ends soon", "last chance", "today only" |
| `none_detected` | (default when no keyword matches) |

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Run duration is non-negative

*For any* ad delivery start date that is on or before the reference date, the computed run duration SHALL be ≥ 0.

**Validates: Requirements 2.1**

---

### Property 2: Enriched ad signal fields are never undefined

*For any* raw Ad Library ad record (including records with missing or null fields), every signal field in the resulting EnrichedAd SHALL be present (not `undefined`) — it may be `null` but must not be absent.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8**

---

### Property 3: Tier classification covers all ads

*For any* array of enriched ads, the union of `top_performers`, `low_performers`, and `unclassified` in the resulting Intelligence_Report SHALL contain exactly the same ads as the input array (no ads added, no ads dropped).

**Validates: Requirements 3.1, 3.3, 3.4, 3.5**

---

### Property 4: Small result sets are all unclassified

*For any* array of fewer than 3 enriched ads, every ad in the array SHALL be classified as `unclassified`.

**Validates: Requirements 3.6**

---

### Property 5: Frequency maps sum to tier size

*For any* tier of enriched ads and any signal field, the sum of all values in the frequency map for that field SHALL equal the number of ads in that tier.

**Validates: Requirements 4.1, 4.2, 4.3, 4.4**

---

### Property 6: Intelligence Report is JSON round-trippable

*For any* Intelligence_Report produced by `buildIntelligenceReport`, serialising it with `JSON.stringify` then deserialising with `JSON.parse` SHALL produce a value that is deeply equal to the original.

**Validates: Requirements 5.5**

---

### Property 7: Empty query is rejected without a network call

*For any* string composed entirely of whitespace characters, calling `searchAdLibrary` with that string as `query` SHALL return a structured error with `type: "invalid_input"` and SHALL NOT make a network request.

**Validates: Requirements 1.6**

---

### Property 8: Composite score ordering is consistent with tier assignment

*For any* array of 3 or more enriched ads, every ad in `top_performers` SHALL have a composite score ≥ every ad in `low_performers`.

**Validates: Requirements 3.2, 3.3, 3.4**

---

## Error Handling

All errors follow the existing pattern in `metaClient.js`:

```js
{ error: { type, message, retryable, meta_code? } }
```

| Scenario | type | retryable |
|---|---|---|
| Empty/whitespace query | `invalid_input` | false |
| limit > 200 | `invalid_input` | false |
| HTTP 401/403 from Ad Library | `auth_error` / `permission_error` | false |
| HTTP 429 or rate-limit code | `rate_limit` | true |
| Network failure | `network_error` | true |
| Unknown Meta error | `unknown_error` | false |

When the Ad Library client returns an error object, `MetaAdsClient` methods return it directly. The server's existing `toolHandlers` dispatch already surfaces `result?.error` as `isError: true`.

---

## Testing Strategy

The project uses **Jest** (already installed). The testing approach mirrors the existing `intelligence.test.js` and `metrics.test.js` files.

### Unit Tests (`src/marketIntelligence.test.js`)

Focus on specific examples and edge cases:

- `computeRunDuration` with a start date equal to the reference date → 0
- `computeRunDuration` with a stop date in the past → uses stop date, not today
- `scoreImpressionRange` with null → 0
- `inferOfferSignal` with text containing multiple signal keywords → returns first match
- `enrichAd` with a fully null raw record → all signal fields present and null-safe
- `classifyTiers` with exactly 2 ads → all `unclassified`
- `buildIntelligenceReport` with 0 ads → correct empty report shape

### Property-Based Tests (`src/marketIntelligence.test.js`)

The project does not currently use a property-based testing library. **fast-check** is the recommended addition for JavaScript/Node.js property testing.

Install: `npm install --save-dev fast-check`

Each property test runs a minimum of **100 iterations**.

Tag format: `// Feature: market-intelligence-tool, Property N: <property text>`

**Property 1 test** — `computeRunDuration` always returns ≥ 0 when start ≤ reference
```
// Feature: market-intelligence-tool, Property 1: run duration is non-negative
fc.assert(fc.property(fc.date(), fc.date(), (d1, d2) => {
  const start = d1 < d2 ? d1 : d2;
  const ref   = d1 < d2 ? d2 : d1;
  return computeRunDuration(start.toISOString(), null, ref) >= 0;
}), { numRuns: 100 });
```

**Property 2 test** — `enrichAd` never produces undefined signal fields
```
// Feature: market-intelligence-tool, Property 2: enriched ad signal fields are never undefined
fc.assert(fc.property(arbitraryRawAd(), (rawAd) => {
  const enriched = enrichAd(rawAd, new Date());
  const signalFields = ['run_duration_days','impression_range','hook_signal',
                        'format_signal','offer_signal','cta_signal','performance_tier'];
  return signalFields.every(f => f in enriched);
}), { numRuns: 100 });
```

**Property 3 test** — tier union equals input
```
// Feature: market-intelligence-tool, Property 3: tier classification covers all ads
fc.assert(fc.property(fc.array(arbitraryEnrichedAd(), { minLength: 0, maxLength: 50 }), (ads) => {
  const report = buildIntelligenceReport(ads, 'test', 'US', null);
  const allTiered = [...report.top_performers, ...report.low_performers, ...report.unclassified];
  return allTiered.length === ads.length;
}), { numRuns: 100 });
```

**Property 4 test** — fewer than 3 ads → all unclassified
```
// Feature: market-intelligence-tool, Property 4: small result sets are all unclassified
fc.assert(fc.property(fc.array(arbitraryEnrichedAd(), { minLength: 0, maxLength: 2 }), (ads) => {
  const report = buildIntelligenceReport(ads, 'test', 'US', null);
  return report.top_performers.length === 0 && report.low_performers.length === 0;
}), { numRuns: 100 });
```

**Property 5 test** — frequency map values sum to tier size
```
// Feature: market-intelligence-tool, Property 5: frequency maps sum to tier size
fc.assert(fc.property(fc.array(arbitraryEnrichedAd(), { minLength: 3, maxLength: 50 }), (ads) => {
  const report = buildIntelligenceReport(ads, 'test', 'US', null);
  for (const tier of [report.top_performers, report.low_performers]) {
    const freqs = computeFrequencies(tier, 'hook_signal');
    const total = Object.values(freqs).reduce((s, v) => s + v, 0);
    if (total !== tier.length) return false;
  }
  return true;
}), { numRuns: 100 });
```

**Property 6 test** — JSON round-trip
```
// Feature: market-intelligence-tool, Property 6: Intelligence Report is JSON round-trippable
fc.assert(fc.property(fc.array(arbitraryEnrichedAd(), { minLength: 0, maxLength: 30 }), (ads) => {
  const report = buildIntelligenceReport(ads, 'test', 'US', null);
  return JSON.stringify(JSON.parse(JSON.stringify(report))) === JSON.stringify(report);
}), { numRuns: 100 });
```

**Property 7 test** — whitespace query rejected without network call (unit example, not property)

**Property 8 test** — composite score ordering consistent with tier
```
// Feature: market-intelligence-tool, Property 8: composite score ordering consistent with tier
fc.assert(fc.property(fc.array(arbitraryEnrichedAd(), { minLength: 3, maxLength: 50 }), (ads) => {
  const report = buildIntelligenceReport(ads, 'test', 'US', null);
  const minTop = Math.min(...report.top_performers.map(a => a.composite_score));
  const maxLow = Math.max(...report.low_performers.map(a => a.composite_score));
  if (report.top_performers.length === 0 || report.low_performers.length === 0) return true;
  return minTop >= maxLow;
}), { numRuns: 100 });
```
