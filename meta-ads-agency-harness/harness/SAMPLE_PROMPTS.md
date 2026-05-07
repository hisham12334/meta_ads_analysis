# Sample Prompts

## Brand Intake Prompt

```text
You are acting as an experienced ecommerce marketing agency.

The owner says they are ready to run Meta Ads.

Use `BRAND_INTAKE_QUESTIONNAIRE.md`.

Your job:
- Ask only the next most important questions.
- Do not create a strategy until the required minimum is known.
- Flag any red risks clearly.
- Keep the owner moving forward without overwhelming them.
```

## Market Research Prompt

```text
Use the installed `competitor-analysis` skill.

Brand context:
[paste brand intake summary]

Research direct competitors, competitor positioning, pricing, offers, messaging, and differentiation gaps.

Output a concise competitor brief that can feed the strategy memo.
```

## Offer Strategy Prompt

```text
Use the installed `offer-extraction` skill and the local `100m-offers` skill.

Local skill files:
- `skills/100m-offers-skill/SKILL.md`
- `skills/100m-offers-skill/references/hormozi-frameworks.md`

Brand context:
[paste brand intake summary]

Competitor context:
[paste competitor brief]

Create:
- Three offer angles.
- One dominant offer.
- Why this offer is believable.
- Why now matters.
- Proof needed to support the claim.
- Specific target avatar.
- Dream outcome.
- Nightmare avoided.
- Core mechanism.
- Value equation diagnosis.
- Value stack table.
- Guarantee or risk reversal.
- Real urgency or scarcity.
- Three offer name options.
```

## Shopify Marketing Prompt

```text
Use the installed `shopify-marketing` skill.

Store URL:
[store URL]

Brand context:
[paste intake summary]

Assess the Shopify store for paid traffic readiness:
- Product page clarity.
- Offer visibility.
- Trust signals.
- Checkout friction.
- Email/SMS capture.
- Retention opportunities.
- App or tracking gaps.
```

## Meta Ads Launch Prompt

```text
Use the installed `meta-ads` skill and `STRATEGY_OUTPUT_TEMPLATE.md`.

Brand context:
[paste intake summary]

Offer:
[paste offer strategy]

Store readiness:
[paste Shopify readiness summary]

Create a Meta Ads launch strategy with:
- Campaign structure.
- Budget plan.
- Creative tests.
- Tracking checklist.
- Kill, keep, and scale rules.
- Owner decisions needed before launch.
```

## Performance Review Prompt

```text
Use `PERFORMANCE_REVIEW_TEMPLATE.md`.

Call the read-only Meta Ads MCP tools:
- `get_account_summary`
- `get_campaign_insights`
- `get_adset_insights`
- `get_ad_insights`
- `get_creative_fatigue_report`
- `diagnose_performance`

Then write a performance review that separates:
- Winners.
- Watchlist.
- Losers.
- Recommended actions.
- Actions needing owner approval.
```

## Approval Prompt

```text
Use `HUMAN_APPROVAL_POLICY.md`.

The model has recommended a live ad account change.

Before any write tool is used, produce a clear approval request:
- Action.
- Entity.
- Current state.
- Proposed change.
- Reason.
- Expected upside.
- Risk.
- Rollback plan.

Require specific owner approval.
```

## No-Data Fallback Prompt

```text
The Meta Ads MCP does not have valid credentials yet.

Do not pretend to have live ad data.

Ask the owner for:
- Meta ad account access status.
- Ad account ID.
- Whether `ads_read` permission is available.
- Whether they want read-only analytics first.

Offer to continue with strategy and launch preparation using brand/store context only.
```
