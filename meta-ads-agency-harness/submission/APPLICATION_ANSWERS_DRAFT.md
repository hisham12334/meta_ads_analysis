# Application Answers Draft

Use this as raw material for the Tally form, email, or recruiter message.

## Project Title

AI Creative Intelligence Workflow for Shopify Meta Ads

## Short Description

I built a practical ecommerce growth workflow and used it on QADR Fits, a single-product hoodie store selling in India with only 9 units left and an INR 1,300 launch budget. The workflow analyzes the store, researches competitors, extracts offer and creative angles, generates Meta ad creative, recommends campaign structure and budget, defines success metrics, and enforces human approval before any live ad spend changes.

## What I Built

The project has three parts:

1. A read-only Meta Ads MCP server that pulls account, campaign, ad set, ad, daily trend, breakdown, ROAS, anomaly, creative brief, and spend pacing data.
2. A marketing harness that sequences brand intake, competitor research, offer strategy, Shopify readiness, creative generation, performance review, and approval.
3. Local skills and guardrails that encode performance creative judgment, offer strategy, budget safety, and approval boundaries.

## Why This Business Problem Matters

Most small ecommerce brands do not fail because they cannot write an ad. They fail because they launch ads without knowing the buyer, competitor patterns, offer strength, tracking readiness, margin constraints, or when to kill versus keep a campaign. This workflow forces those decisions before money is spent.

## Builder Stack

- LLM: reasoning, synthesis, campaign planning, ad copy generation, and self-evaluation.
- MCP tools: read-only Meta Ads connector for performance and pacing data.
- Skills: competitor analysis, Shopify marketing, offer extraction, 100m offers, ad creative, marketing analytics, CRO.
- Evals: LLM-as-judge rubric for creative and strategy quality.
- Guardrails: no autonomous spend, exact owner approval required for publishing, pausing, budget, targeting, or offer changes.

## Proof To Insert

Current real run:

The workflow was used for QADR Fits on May 3, 2026. It produced a Sales campaign setup for India, a lifetime budget of INR 1,300, a May 3-May 5 schedule, a limited-stock/free-shipping offer, three ad creative directions, and campaign/ad set naming.

Verified Meta result:

- Campaign: `META_Sales_India_QADR-Hoodie_Last9Stock_May`
- Spend: INR 270.06
- Impressions: 1,297
- Link clicks: 99
- Landing page views: 53
- Add-to-carts: 8
- Initiated checkouts: 3
- Add payment info events: 1
- CTR: 7.17%
- Cost per add-to-cart: INR 33.76
- Cost per initiated checkout: INR 90.02

Honest caveat:

Meta did not return purchase events or ROAS, so I am not claiming a sale. The strongest honest business proof is that the workflow generated measurable purchase intent on a real ad account.

## Guardrails Summary

The system can analyze, recommend, and draft. It cannot silently publish, pause, edit targeting, or change budgets. Every live change requires explicit owner approval with the exact entity, current state, proposed change, reason, risk, and rollback plan.

## Link/Repo Summary

Point reviewers to:
- `meta-ads-agency-harness/PROJECT.md`
- `meta-ads-agency-harness/meta-ads-mcp/src/server.js`
- `meta-ads-agency-harness/meta-ads-mcp/src/intelligence.js`
- `meta-ads-agency-harness/harness/HUMAN_APPROVAL_POLICY.md`
- `meta-ads-agency-harness/submission/LLM_JUDGE_LOOP_TEMPLATE.md`
