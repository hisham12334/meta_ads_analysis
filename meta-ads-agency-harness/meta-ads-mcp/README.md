# Meta Ads Read-Only MCP

Dependency-free Node MCP server for reading Meta Ads performance data.

This is intentionally narrow. It is not a Supermetrics clone and it does not change live ads.

## Requirements

- Node.js 18 or newer.
- Meta Business Manager access.
- Meta Developer app with Marketing API access.
- Meta ad account ID.
- Meta access token with read permissions for the ad account.

## Setup

Copy `.env.example` into your MCP runtime environment and set:

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

The server communicates over stdio using JSON-RPC/MCP.

## Tools

- `get_ad_accounts`
- `get_account_summary`
- `get_campaign_insights`
- `get_adset_insights`
- `get_ad_insights`
- `get_daily_performance`
- `get_breakdown_insights`
- `get_creative_fatigue_report`
- `diagnose_performance`
- `search_ad_library`
- `analyse_market`

## Market Intelligence Features

The latest release introduces the **Market Intelligence Tool**, providing advanced insights into competitor ads via the Meta Ad Library API:

- **Ad Search & Extraction**: Fetches publicly visible competitor ads based on niche/keyword queries.
- **Signal Enrichment**: Enriches raw ads with performance signals such as:
  - Computed run duration
  - Impression range scoring
  - Hook, offer, and format signal detection
- **Performance Tier Classification**: Automatically categorizes ads into top, low, or unclassified performance tiers based on a composite score.
- **Intelligence Reports**: Generates a comprehensive report highlighting pattern frequencies (hooks, offers, formats, CTAs) and workflow context hints, ready to feed directly into the Creative Intelligence Workflow.

## Example Tool Arguments

```json
{
  "date_preset": "last_7d",
  "limit": 50
}
```

```json
{
  "time_range": {
    "since": "2026-04-26",
    "until": "2026-05-03"
  },
  "target_roas": 3,
  "minimum_spend_to_judge": 1500
}
```

## Safety Boundary

This MCP is read-only. It can recommend actions, but it cannot pause campaigns, change budgets, publish ads, or edit targeting.

Future write tools should be added only after Meta app review and a human approval flow.
