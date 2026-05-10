# Deck And Video Outline

## Slide Deck

Aim for 8 slides. Keep the story about a real business outcome, not code volume.

### 1. Problem

Small Shopify brands waste ad spend because they jump from "write me ads" to launch without competitor research, offer diagnosis, tracking checks, or budget guardrails.

### 2. Business Chosen

Include:
- Brand name
- Product
- Price/AOV
- Gross margin
- Target geography
- Current growth bottleneck
- Why you understand this buyer

### 3. Workflow

Show the chain:

Brand intake -> competitor research -> offer strategy -> creative brief -> ad copy generation -> LLM judge -> campaign structure -> spend pacing -> owner approval -> shipped output

### 4. Builder Stack

Five layers:
- LLM reasoning engine
- MCP tools: Meta Ads read-only connector
- Skills: competitor analysis, Shopify marketing, 100m offers, ad creative
- Evals: LLM-as-judge rubric and regenerate loop
- Guardrails: human approval policy and no autonomous spend rule

### 5. Example Run

Show one real run:
- Intake summary
- Competitor insight
- Winning hook/angle
- Generated ad copy
- Campaign budget/audience recommendation

### 6. LLM-As-Judge Loop

Show:
- Bad first output
- Rubric score
- Failure reasons
- Regenerated output
- Improved score

This is the slide reviewers will care about most.

### 7. Guardrails

Show:
- Read-only MCP first
- No autonomous spend
- Budget increases capped at 20% unless explicitly approved
- Publishing, pausing, targeting, budget, and offer changes require owner approval
- Exact approval text required

### 8. Proof

Use QADR Fits:
- Campaign: `META_Sales_India_QADR-Hoodie_Last9Stock_May`
- Spend: INR 270.06
- 99 link clicks
- 53 landing page views
- 8 add-to-carts
- 3 initiated checkouts
- 1 add-payment-info event
- No purchase/ROAS claimed because Meta returned no purchase event

## Six-Minute Video Script

### 0:00-0:30 - Setup

"I picked [brand], a [category] business selling [product]. The business problem was [problem]. I built a workflow that turns business context and Meta Ads data into a campaign recommendation with evals and guardrails."

### 0:30-1:20 - Architecture

Show the repo:
- `PROJECT.md`
- `meta-ads-mcp/src/server.js`
- `harness/`
- `skills/`

Say:
"The MCP is read-only. It analyzes performance, but every spend-changing action needs owner approval."

### 1:20-2:30 - End-To-End Run

Show:
- Brand intake summary
- Competitor brief
- Offer strategy
- Generated creative brief
- Ad copy output

### 2:30-3:40 - LLM Judge Loop

Show:
- First weak ad output
- Rubric score
- Why it failed
- Improved output
- New score

### 3:40-4:40 - Campaign Plan

Show:
- Budget
- Audience
- Creative tests
- Success metrics
- Kill/keep/scale rules

### 4:40-5:30 - Guardrails

Show `HUMAN_APPROVAL_POLICY.md`.

Say:
"The system never silently spends money. It prepares decisions; the founder decides."

### 5:30-6:00 - Proof

Show the strongest real evidence:
- Meta campaign/ad account metrics
- QADR Fits launch conversation
- Ad-level winner: `Stock Scarcity - Copy`

Say only what is true:
"This produced measurable purchase intent: 99 link clicks, 8 add-to-carts, 3 initiated checkouts, and 1 add-payment-info event from INR 270.06 spend. I am not claiming ROAS or sales because Meta did not return a purchase event."
