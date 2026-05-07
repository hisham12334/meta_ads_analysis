# Meta Ads MCP Schema

## Purpose

This file defines the first read-only Meta Ads MCP connector for the agency harness.

The connector should answer performance questions for ecommerce Meta Ads accounts without trying to become a full Supermetrics replacement.

## Scope

Version 1 is read-only.

It should:

- Pull ad account metadata.
- Pull campaign, ad set, and ad performance.
- Pull daily performance trends.
- Pull breakdowns such as age, gender, country, publisher platform, and placement.
- Normalize common ecommerce metrics.
- Return enough context for the AI harness to recommend actions.

It should not:

- Publish ads.
- Pause ads.
- Change budgets.
- Create campaigns.
- Edit targeting.
- Store raw access tokens in code.

## Required Environment Variables

```text
META_ACCESS_TOKEN=
META_AD_ACCOUNT_ID=act_1234567890
META_API_VERSION=v23.0
```

Optional:

```text
META_BUSINESS_ID=
META_DEFAULT_ATTRIBUTION_WINDOWS=7d_click,1d_view
```

## Common Inputs

Most reporting tools should accept:

```json
{
  "date_preset": "last_7d",
  "time_range": {
    "since": "2026-04-26",
    "until": "2026-05-03"
  },
  "level": "campaign",
  "limit": 100
}
```

Rules:

- Use either `date_preset` or `time_range`.
- Default `date_preset` should be `last_7d`.
- Default `limit` should be `100`.
- Use account attribution settings unless the caller explicitly asks otherwise.

## Standard Metrics

Base fields to request from Meta Insights:

```text
account_id
account_name
campaign_id
campaign_name
adset_id
adset_name
ad_id
ad_name
objective
optimization_goal
date_start
date_stop
spend
impressions
reach
frequency
clicks
inline_link_clicks
outbound_clicks
ctr
cpc
cpm
cpp
actions
action_values
cost_per_action_type
purchase_roas
website_purchase_roas
```

Derived ecommerce fields:

```text
purchases
purchase_value
cost_per_purchase
roas
link_click_rate
thumbstop_rate
```

Notes:

- Purchases usually come from `actions` where `action_type` is a purchase-like event.
- Purchase value usually comes from `action_values`.
- ROAS can come from `purchase_roas` or `website_purchase_roas` when available.
- If Meta does not return a field, the connector should return `null` plus a warning, not crash.

## Tool 1: get_ad_accounts

Purpose:

Return ad accounts accessible by the token.

Input:

```json
{}
```

Output:

```json
{
  "accounts": [
    {
      "id": "act_1234567890",
      "name": "Brand Ad Account",
      "currency": "INR",
      "timezone_name": "Asia/Kolkata",
      "account_status": 1
    }
  ]
}
```

## Tool 2: get_account_summary

Purpose:

Give an executive-level view of current account performance.

Input:

```json
{
  "date_preset": "last_7d"
}
```

Meta level:

```text
account
```

Output:

```json
{
  "account_id": "act_1234567890",
  "date_start": "2026-04-26",
  "date_stop": "2026-05-03",
  "spend": 25000,
  "impressions": 500000,
  "reach": 220000,
  "clicks": 8500,
  "ctr": 1.7,
  "cpm": 50,
  "purchases": 120,
  "purchase_value": 180000,
  "cost_per_purchase": 208.33,
  "roas": 7.2,
  "warnings": []
}
```

## Tool 3: get_campaign_insights

Purpose:

Compare campaigns and identify winners, losers, and campaigns that need more data.

Input:

```json
{
  "date_preset": "last_7d",
  "status_filter": ["ACTIVE", "PAUSED"],
  "limit": 100
}
```

Meta level:

```text
campaign
```

Output:

```json
{
  "campaigns": [
    {
      "campaign_id": "123",
      "campaign_name": "META_Sales_Broad_CoreOffer_2026M05",
      "objective": "OUTCOME_SALES",
      "spend": 10000,
      "impressions": 200000,
      "ctr": 1.4,
      "cpm": 50,
      "purchases": 40,
      "purchase_value": 70000,
      "cost_per_purchase": 250,
      "roas": 7,
      "recommendation_context": {
        "enough_spend_to_judge": true,
        "primary_issue": null
      }
    }
  ],
  "warnings": []
}
```

## Tool 4: get_adset_insights

Purpose:

Compare audiences, budgets, and optimization pockets inside campaigns.

Input:

```json
{
  "campaign_id": "123",
  "date_preset": "last_7d",
  "limit": 100
}
```

Meta level:

```text
adset
```

Output:

```json
{
  "adsets": [
    {
      "campaign_id": "123",
      "campaign_name": "META_Sales_Broad_CoreOffer_2026M05",
      "adset_id": "456",
      "adset_name": "Broad_18-45_India",
      "spend": 5000,
      "frequency": 1.8,
      "ctr": 1.9,
      "cpm": 45,
      "purchases": 28,
      "cost_per_purchase": 178.57,
      "roas": 8.4
    }
  ],
  "warnings": []
}
```

## Tool 5: get_ad_insights

Purpose:

Find winning and losing creatives.

Input:

```json
{
  "adset_id": "456",
  "date_preset": "last_7d",
  "limit": 100
}
```

Meta level:

```text
ad
```

Output:

```json
{
  "ads": [
    {
      "campaign_id": "123",
      "adset_id": "456",
      "ad_id": "789",
      "ad_name": "UGC_Hook1_BenefitDemo",
      "spend": 2000,
      "impressions": 40000,
      "inline_link_clicks": 900,
      "ctr": 2.2,
      "cpm": 50,
      "purchases": 15,
      "cost_per_purchase": 133.33,
      "roas": 9.1
    }
  ],
  "warnings": []
}
```

## Tool 6: get_daily_performance

Purpose:

Show whether performance is improving, worsening, or too volatile to judge.

Input:

```json
{
  "level": "campaign",
  "entity_id": "123",
  "time_range": {
    "since": "2026-04-26",
    "until": "2026-05-03"
  }
}
```

Meta params:

```text
time_increment=1
```

Output:

```json
{
  "level": "campaign",
  "entity_id": "123",
  "days": [
    {
      "date_start": "2026-05-01",
      "spend": 3000,
      "purchases": 12,
      "cost_per_purchase": 250,
      "roas": 5.8
    }
  ],
  "trend_summary": {
    "spend_direction": "up",
    "roas_direction": "flat",
    "conversion_volume": "sufficient"
  },
  "warnings": []
}
```

## Tool 7: get_breakdown_insights

Purpose:

Identify demographic, geography, device, and placement pockets.

Input:

```json
{
  "level": "adset",
  "entity_id": "456",
  "date_preset": "last_7d",
  "breakdowns": ["age", "gender"]
}
```

Allowed first-version breakdowns:

```text
age
gender
country
region
publisher_platform
platform_position
device_platform
impression_device
```

Output:

```json
{
  "breakdowns": ["age", "gender"],
  "rows": [
    {
      "age": "25-34",
      "gender": "female",
      "spend": 2500,
      "impressions": 60000,
      "ctr": 2.1,
      "purchases": 20,
      "cost_per_purchase": 125,
      "roas": 10.4
    }
  ],
  "warnings": []
}
```

## Tool 8: get_creative_fatigue_report

Purpose:

Flag ads that may need creative refresh.

Input:

```json
{
  "date_preset": "last_14d",
  "level": "ad"
}
```

Logic:

- High frequency plus declining CTR can suggest creative fatigue.
- High CPM plus low CTR can suggest weak thumbstop or audience mismatch.
- Good CTR plus poor purchase rate can suggest landing page, offer, or product-page mismatch.

Output:

```json
{
  "ads": [
    {
      "ad_id": "789",
      "ad_name": "UGC_Hook1_BenefitDemo",
      "frequency": 4.2,
      "ctr": 0.7,
      "cpm": 90,
      "fatigue_risk": "high",
      "suggested_action": "Refresh hook and first 3 seconds before increasing spend."
    }
  ],
  "warnings": []
}
```

## Tool 9: diagnose_performance

Purpose:

Return a structured analysis layer for the agency harness.

Input:

```json
{
  "date_preset": "last_7d",
  "target_roas": 3,
  "target_cost_per_purchase": 500,
  "minimum_spend_to_judge": 1500
}
```

Output:

```json
{
  "summary": "Account is profitable overall, but one ad set is spending above target CPA.",
  "winners": [],
  "watchlist": [],
  "losers": [],
  "recommended_actions": [
    {
      "action_type": "scale",
      "entity_type": "adset",
      "entity_id": "456",
      "reason": "ROAS above target with sufficient spend.",
      "requires_human_approval": true
    }
  ],
  "questions_for_owner": [
    "Is inventory sufficient for the winning product if spend increases by 20 percent?"
  ],
  "warnings": []
}
```

## Error Handling

Return structured errors:

```json
{
  "error": {
    "type": "permission_error",
    "message": "The token does not have access to this ad account or required insights permissions.",
    "meta_code": 190,
    "retryable": false
  }
}
```

Common error categories:

- `auth_error`
- `permission_error`
- `rate_limit`
- `invalid_account`
- `invalid_field`
- `api_version_error`
- `network_error`
- `unknown_error`

## Human Approval Boundary

The read-only MCP can recommend actions, but it must not execute changes.

Every future write tool must include:

```json
{
  "requires_human_approval": true,
  "approval_reason": "This changes live ad spend or campaign delivery."
}
```

## References Checked

- Meta Marketing API overview: https://developers.facebook.com/docs/marketing-api/
- Meta Insights API reference: https://developers.facebook.com/docs/marketing-api/insights
- Meta Ads Insights fields are exposed in Meta's official Business SDK object model: https://github.com/facebook/facebook-nodejs-business-sdk
