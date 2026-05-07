# Meta Ads Agency Harness

## Goal

Build a simple, practical agency-style AI system for ecommerce brands that connects brand context, Shopify/store data, Meta Ads performance data, and marketing strategy skills into one guided workflow.

The system should help a brand owner move from "I am ready to run ads" to a structured launch and optimization process:

- Ask the right intake questions before any ad plan is created.
- Use brand and product context to understand the market.
- Research competitors and positioning.
- Craft an offer and go-to-market strategy.
- Help prepare Meta Ads campaigns in a responsible, high-ROI-minded way.
- Read Meta Ads performance data through a narrow Meta Ads MCP connector.
- Recommend actions based on real performance readings.
- Keep a human approval step before budget changes, campaign pauses, or publishing actions.

## Plain-English Vision

Shopify gives us the store and product context.

Meta Ads gives us campaign performance data.

Marketing skills give the model specialized agency-style thinking.

The harness sits in the middle and turns those pieces into a guided operating system for ecommerce growth.

## What This Is

This project is not a full Supermetrics clone.

It is a focused Meta Ads analytics and decision-support layer for one use case:

- Ecommerce brands running Meta Ads.
- Brand owner wants guidance.
- AI asks questions, analyzes, recommends, and helps prepare next actions.
- Real ad account changes should require owner approval.

## What This Is Not

- Not a guarantee of profit or highest ROI from day one.
- Not a way to bypass Meta's API, app review, or permission rules.
- Not a replacement for Meta Business Manager.
- Not a source of private competitor ad performance data.
- Not a fully automated "spend money without human approval" system.

## Recommended System Shape

```text
Brand Intake Agent
        |
        v
Market + Competitor Research Agent
        |
        v
Offer + Strategy Agent
        |
        v
Meta Ads Launch Assistant
        |
        v
Meta Ads MCP Connector
        |
        v
Performance Analytics Agent
        |
        v
Recommendations + Owner Approval
```

## Skill Stack

Use existing skills from skills.sh where possible instead of building every workflow from scratch.

Recommended skills:

1. `phuryn/pm-skills@competitor-analysis`
   - Market and competitor research.

2. `realkimbarrett/advertising-skills@offer-extraction`
   - Extracts and clarifies the real offer.

3. `nexscope-ai/ecommerce-skills@shopify-marketing`
   - Shopify and ecommerce marketing thinking.

4. `kostja94/marketing-skills@meta-ads`
   - Meta Ads campaign strategy and execution thinking.

5. `gnoviawan/agentic-marketing@bmad-agent-marketing-analytics`
   - Marketing analytics and metric interpretation.

6. `manojbajaj95/claude-gtm-plugin@conversion-rate-optimization`
   - Store and landing page conversion improvements.

7. Local `100m-offers` skill from `C:\Users\lenovo\Downloads\100m-offers.skill`
   - Grand Slam Offer strategy: avatar, dream outcome, value equation, value stack, guarantee, urgency, offer naming, and pitch.

## Meta Ads MCP Connector

The first connector should be read-only.

The installed skills do not replace this connector. They improve the model's marketing judgment, but live Meta Ads data still needs to come from a Meta Ads MCP/API layer.

## Installed Skills

Installed globally into `C:\Users\lenovo\.agents\skills`.

1. `competitor-analysis`
   - Source: `phuryn/pm-skills@competitor-analysis`
   - Role in project: identifies direct competitors, positioning gaps, strengths, weaknesses, and differentiation opportunities.

2. `offer-extraction`
   - Source: `realkimbarrett/advertising-skills@offer-extraction`
   - Role in project: converts product/service context into specific, believable, high-converting offer angles.

3. `shopify-marketing`
   - Source: `nexscope-ai/ecommerce-skills@shopify-marketing`
   - Role in project: Shopify/DTC marketing strategy, SEO, paid ads, email, retention, cart abandonment, and app recommendations.

4. `meta-ads`
   - Source: `kostja94/marketing-skills@meta-ads`
   - Role in project: Meta campaign structure, audience targeting, Advantage+, creative testing, tracking, and launch checklist.

5. `bmad-agent-marketing-analytics`
   - Source: `gnoviawan/agentic-marketing@bmad-agent-marketing-analytics`
   - Role in project: measurement plans, KPI hierarchy, dashboards, attribution, ROI analysis, and analytics decision rules.
   - Note: the original search result showed `marketing-analytics`, but the package's actual installable skill is `bmad-agent-marketing-analytics`.

6. `conversion-rate-optimization`
   - Source: `manojbajaj95/claude-gtm-plugin@conversion-rate-optimization`
   - Role in project: CRO audits, funnel analysis, objection mapping, landing page optimization, forms, checkout/signup friction, and A/B test ideas.

7. `100m-offers`
   - Source: local file `C:\Users\lenovo\Downloads\100m-offers.skill`
   - Project copy: `skills/100m-offers-skill`
   - Role in project: strengthens strategy output by building a Grand Slam Offer using avatar specificity, dream outcome, perceived likelihood, speed to result, effort reduction, value stack, guarantee, urgency, and offer naming.

Read-only tools:

- `get_ad_accounts`
- `get_account_summary`
- `get_campaigns`
- `get_campaign_insights`
- `get_adset_insights`
- `get_ad_insights`
- `get_daily_performance`
- `get_breakdowns_by_age_gender_placement`
- `get_roas_report`

Later write-access tools, only after Meta approval and strong human approval flows:

- `pause_campaign`
- `pause_adset`
- `update_campaign_budget`
- `update_adset_budget`
- `create_campaign_draft`
- `duplicate_adset`

## Meta API Requirements

Minimum for analytics:

- Meta Business Manager.
- Meta Developer account.
- Meta app with Marketing API enabled.
- Ad account access.
- Ad Account ID, usually like `act_1234567890`.
- Access token.
- Permissions such as `ads_read` and `read_insights`, depending on Meta's current app setup requirements.

For write/control features:

- `ads_management`.
- Possibly `business_management`.
- Meta app review and approval for production use.
- Clear approval UX before changing campaigns or budgets.

## Initial Harness Workflow

### 1. Brand Intake

Ask the owner for:

- Brand name.
- Website or Shopify store URL.
- Product category.
- Hero products.
- Average order value.
- Gross margin.
- Fulfillment region.
- Target geography.
- Current monthly revenue.
- Current ad spend, if any.
- Best-selling products.
- Customer pain points.
- Existing offer.
- Creative assets available.
- Past ad results.
- Constraints, such as inventory, cash flow, compliance, or shipping.

### 2. Market Research

Use brand context and public sources to identify:

- Direct competitors.
- Indirect competitors.
- Market sophistication.
- Common offers.
- Price positioning.
- Creative angles.
- Messaging gaps.
- Customer objections.

### 3. Offer And Strategy

Produce:

- Core offer.
- Backup offers.
- Hook angles.
- Landing page recommendations.
- Creative testing plan.
- Initial campaign structure.
- Budget plan.
- KPI targets.
- Kill/scale rules.

### 4. Launch Guidance

Guide the owner through:

- Pixel and conversion event readiness.
- Catalog/product feed readiness.
- Campaign objective selection.
- Audience setup.
- Creative upload.
- Ad copy review.
- Budget setup.
- Final approval.

### 5. Performance Analysis

Use Meta Ads data to answer:

- What is spending?
- What is converting?
- What has good CTR but weak conversion?
- What has high CPM?
- What has low ROAS?
- Which creative is winning?
- Which campaign needs more time?
- Which campaign should be paused?
- What should be scaled?

## Decision Rules

The system should separate recommendations from actions.

Safe:

- Analyze performance.
- Recommend changes.
- Draft campaign structure.
- Draft ad copy.
- Flag risky spend.

Needs human approval:

- Publishing ads.
- Pausing campaigns.
- Increasing budgets.
- Decreasing budgets.
- Editing live campaigns.

## Project Tasks

- [x] Clarified that a narrow Meta Ads MCP is possible.
- [x] Clarified that this is not a full Supermetrics clone.
- [x] Identified Meta API as the core data source.
- [x] Identified read-only as the safest first version.
- [x] Searched skills.sh for relevant existing skills.
- [x] Selected recommended skill stack.
- [x] Created project folder.
- [x] Created this project Markdown file.
- [x] Install selected skills.
- [x] Inspect installed skills and summarize what each contributes.
- [x] Design the first read-only Meta Ads MCP schema.
- [x] Scaffold the Meta Ads MCP server.
- [x] Add environment variable template for Meta credentials.
- [x] Implement read-only Meta Ads API client.
- [x] Implement `get_account_summary`.
- [x] Implement `get_campaign_insights`.
- [x] Implement `get_adset_insights`.
- [x] Implement `get_ad_insights`.
- [x] Add safe error handling for expired tokens and permission failures.
- [x] Add sample prompts for the agency harness.
- [x] Create brand intake questionnaire.
- [x] Create strategy output template.
- [x] Create performance review template.
- [x] Add human approval policy for write actions.
- [x] Add local `100m-offers` skill to the strategy workflow.
- [ ] Decide whether to add write-access tools later.

## Next Best Step

Decide whether to add write-access tools later. Before that decision, live-test the read-only MCP against a real Meta ad account token.
