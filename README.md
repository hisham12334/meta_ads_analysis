# Meta Ads Agency Harness

A specialized, AI-driven agency-style system designed to act as an operating system for ecommerce brands running Meta Ads. This tool acts as the connective tissue between a brand's Shopify/store context, Meta Ads performance data, and structured marketing strategy skills.

## Features & Use Cases

This project provides a focused Meta Ads analytics and decision-support layer:

- **Brand Intake**: Ask structured questions to understand brand context, constraints, existing offers, and creative assets.
- **Market & Competitor Research**: Search the Meta Ad Library, enrich competitor ads with performance signals (hook, format, offer), classify them into tiers, and extract actionable patterns.
- **Offer & Strategy Generation**: Translate product context into high-converting angles, core offers, guarantees, and creative testing plans.
- **Launch Guidance**: Walkthrough campaign setup, pixel readiness, and budget plans.
- **Performance Analytics**: Read Meta Ads data (campaign, adset, and ad-level), highlight creative fatigue, diagnose low ROAS or CTR, and monitor daily trends.
- **Spend Pacing & Anomaly Detection**: Track budget pacing against monthly goals, compute breakeven ROAS, and flag anomalies like tracking breaks or sudden CPA spikes.

### The Use Case

An ecommerce brand owner wants to launch and optimize Meta Ads but needs strategic guidance. The system:
1. Absorbs the brand and store context.
2. Analyzes the market using the Meta Ad Library.
3. Formulates a strategy and offer based on deep marketing skills.
4. Reads live performance data directly via a read-only Meta Ads MCP connector.
5. Surfaces recommendations for the owner to approve before executing any changes.

---

## System Architecture: Three Layers, One Coherent System

Here's exactly what it is and how it fits together:

### Layer 1 — Anomaly Detection with Root-Cause Diagnosis

The MCP watches your account metrics and detects meaningful deviations — not just "CPM went up" but "CPM jumped 38% in 2 days while CTR held steady, which is an auction density signal, not a creative problem." Every anomaly gets a plain-English explanation with a root cause category and a specific next action. No red numbers on a dashboard. A sentence you can act on.

Seven root cause categories, each with a distinct signal pattern:
- **`auction_pressure`** — CPM rising, CTR stable → competitors entered your auction
- **`creative_fatigue`** — frequency rising, CTR declining together
- **`tracking_break`** — purchases drop to zero while spend continues
- **`learning_phase_reset`** — erratic daily variance after a recent edit
- **`audience_saturation`** — reach declining, frequency climbing
- **`offer_mismatch`** — strong CTR but weak purchase rate
- **`budget_pacing`** — spend rate vs monthly budget projection

### Layer 2 — Creative Brief Generator from Winning Ad Data

When an ad is winning, the system extracts the pattern — hook type, angle, audience pocket, CTR range, ROAS — and generates a ready-to-use creative brief for 3 new variations. It uses the ad-creative skill from `coreyhaines31/marketingskills` (333K installs, top 1% on skills.sh) combined with the existing `100m-offers` skill. The brief is structured so you can hand it directly to a UGC creator, designer, or copywriter with zero translation work.

### Layer 3 — Spend Pacing + Cash Flow Projection

Given current daily spend rate, monthly budget cap, and gross margin, the system projects: will you overspend or underspend this month, what's your projected profit/loss at current ROAS, and what's the break-even ROAS for your margin. Updates every time you call it. No extra API permissions needed.

---

## New MCP Tools

Three new tools have been added to the server to support this intelligence layer:

- **`detect_anomalies`** — scans the last N days of daily performance, compares against a rolling baseline, flags deviations above a configurable threshold, returns root cause + plain-English explanation + recommended action for each.
- **`generate_creative_brief`** — takes a winning ad ID (or the top N ads by ROAS), extracts the performance pattern, and returns a structured creative brief with hook angles, format recommendations, audience notes, and 3 variation directions. Integrates with ad-creative and 100m-offers skill context.
- **`get_spend_pacing`** — takes monthly budget, daily spend history, gross margin, and target ROAS, returns projected month-end spend, projected profit/loss, days remaining, pacing status (on-track / overpacing / underpacing), and break-even ROAS.

---

## On the New Builder Stack

This project is built using a modern AI builder stack oriented toward deterministic, reliable workflows:
- **MCP (Model Context Protocol)**: We built a custom Node-based MCP server (`meta-ads-mcp`) to act as a read-only bridge to the Meta Graph API and Ad Library API. This ensures the AI models interact with a standardized, structured API surface rather than writing ad-hoc scripts.
- **Pure-Function Intelligence Layer**: The analysis logic (anomaly detection, creative briefs, spend pacing, and ad enrichment) is decoupled from the network layer. This allows for rigorous property-based testing and unit testing.
- **Fast-Check Property Testing**: We enforce robust data contracts (e.g., run duration limits, non-null signal fields, and JSON round-trippability) using property-based testing.

## On the Skill Document

The project relies heavily on a curated "Skill Stack" of localized `.skill` documents to instill specialized agency thinking into the AI model. Rather than relying on base model knowledge, the system loads predefined instructions to frame its decision-making:
- **`competitor-analysis`**: Gaps and positioning evaluation.
- **`offer-extraction`**: Distilling products into high-converting angles.
- **`meta-ads`**: Campaign structure, Advantage+, and tracking setup.
- **`bmad-agent-marketing-analytics`**: Interpreting KPIs, attribution, and ROI.
- **`100m-offers`**: Building a "Grand Slam Offer" via specific avatars, dream outcomes, value stacks, and guarantees.
- **`coreyhaines31/marketingskills@ad-creative`** *(New skill to install)*: The top performance creative skill on skills.sh. It knows Meta ad specs, creative iteration patterns, hook formulas, and how to generate variations from performance data. Combined with the existing 100m-offers skill, the brief generator has both the offer architecture layer and the ad execution layer.

## On the LLM-as-Judge Loop

To maintain the quality of the strategic outputs and analytical summaries, the system leverages an LLM-as-judge loop:
- **Pattern Classification**: When parsing competitor ads or analyzing live campaign performance, the system maps raw string inputs and metric thresholds to ordinal scores or explicit categories (e.g., `top_performer`, `low_performer`, `creative_fatigue`, `low_roas`).
- **Explanation & Justification**: The insights are not just passed as numbers. The LLM reviews the grouped classifications and generates plain-English reasoning (e.g., "Why did this anomaly occur?" or "What hooks are driving the top tier?").
- **Quality Assurance**: By isolating the data fetching and pure-function logic in code, the LLM is restricted to judging the context and formulating recommendations, preventing hallucinations on raw metrics.

## On Guardrails of this Project

Safety and reliability are foundational to this tool:
- **Read-Only by Default**: The MCP connector strictly implements read-only endpoints (e.g., `/insights`, `/ads_archive`). It is physically impossible for the AI to alter live campaigns, change budgets, or publish ads.
- **Human-in-the-Loop Approval**: Any recommended action (pausing a campaign, scaling a budget) is clearly separated from data analysis. The owner must explicitly approve and manually apply write actions.
- **Data Clamping & Validation**: The API clients clamp limits (e.g., max 200 ads), enforce non-empty queries, and gracefully map Meta Graph errors (429 Rate Limit, 403 Permission Error, etc.) to structured, actionable formats rather than crashing the loop.
- **Minimum Spend Thresholds**: To prevent premature decisions, algorithms strictly ignore ads that haven't met a minimum spend threshold (default ₹1500), preventing random statistical noise from driving strategy.
