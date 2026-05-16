# Meta Ads Intelligence MCP

Local Node.js MCP server providing the intelligence and Ad Library analysis layer for the Meta Ads agency workflow.

This server runs **alongside** the official Meta Ads MCP (`mcp.facebook.com/ads`) — it does not replace it.

## Architecture

Two MCP servers are active in this project:

| Server | Config key | What it does |
|---|---|---|
| [Official Meta Ads MCP](https://mcp.facebook.com/ads) | `meta-ads-official` | Read/write campaign ops, catalog, pixel diagnostics, insights, benchmarks — 29 tools via Meta Business OAuth. No token setup required. |
| This server | `meta-ads-intelligence` | Ad Library competitor research, market analysis, creative briefs, anomaly detection, spend pacing — 5 tools not covered by the official MCP. |

The official MCP owns everything that touches live campaigns. This server owns custom analysis logic and Ad Library data.

## Tools (5)

### Creative Intelligence Engine

- `detect_anomalies` — detect metric anomalies in daily performance data with root-cause classification and plain-English explanations. Covers 7 root causes: auction pressure, creative fatigue, tracking break, learning phase reset, audience saturation, offer mismatch, budget pacing.
- `generate_creative_brief` — data-driven creative brief from top-performing ads. Returns 3 variation directions, Meta specs, and skill references.
- `get_spend_pacing` — project month-end spend against a monthly budget. Returns breakeven ROAS, projected profit/loss, and recommended daily budget.

### Market Intelligence (Ad Library)

- `search_ad_library` — search Meta Ad Library by keyword/niche and return enriched competitor ads with hook, format, and offer signals.
- `analyse_market` — full market intelligence report: tier classification, hook/format/offer/CTA pattern frequencies, and workflow context hints ready to feed into the creative brief workflow.

## What the Official Meta MCP Covers

The `meta-ads-official` server handles these — don't duplicate them here:

- Campaign, ad set, and ad creation/editing (`ads_create_*`, `ads_update_entity`)
- Budget changes and activation (`ads_activate_entity`)
- Product catalog management (10 catalog tools)
- Pixel and Conversions API diagnostics (`ads_get_dataset_*`, `ads_get_errors`)
- Performance trends and anomaly signals (`ads_insights_*`)
- Industry benchmarks and auction ranking (`ads_insights_industry_benchmark`, `ads_insights_auction_ranking_benchmarks`)
- Opportunity scores (`ads_get_opportunity_score`)

## Requirements

- Node.js 18 or newer
- Meta access token with `ads_read` and `pages_read_engagement` scopes (for Ad Library calls)
- Meta ad account ID

## Setup

Copy `.env.example` and fill in:

```text
META_ACCESS_TOKEN=
META_AD_ACCOUNT_ID=act_1234567890
META_API_VERSION=v23.0
```

Do not commit real tokens.

## Run

```bash
npm start
```

Communicates over stdio using JSON-RPC/MCP.

## Safety

This server is read-only. It cannot pause campaigns, change budgets, or publish ads. All recommended actions require human approval before being executed via the official MCP.
