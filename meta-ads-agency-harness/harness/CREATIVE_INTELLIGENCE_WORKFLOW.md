# Creative Intelligence Workflow

## Purpose

This workflow combines three new MCP tools into a single diagnostic and planning sequence.
Run it weekly or whenever performance changes unexpectedly.

The sequence is:

```
1. detect_anomalies      → find what changed and why
2. generate_creative_brief → build the solution for flagged entities
3. get_spend_pacing      → confirm budget is on track before acting
```

---

## When To Run This Workflow

- Weekly performance review
- After a CPM spike or CTR drop
- Before scaling a winning campaign
- After a creative refresh to check if it worked
- Any time ROAS drops more than 20% in 3 days

---

## Step 1: Detect Anomalies

Run `detect_anomalies` first. It scans the last 14 days of daily performance, compares the
first half (baseline) to the second half (recent), and classifies any significant deviations
into one of seven root-cause categories.

### Example call

```json
{
  "tool": "detect_anomalies",
  "arguments": {
    "date_preset": "last_14d",
    "level": "campaign",
    "anomaly_threshold": 0.2,
    "monthly_budget": 30000
  }
}
```

To scope to a specific campaign:

```json
{
  "tool": "detect_anomalies",
  "arguments": {
    "date_preset": "last_14d",
    "level": "campaign",
    "entity_id": "123456789",
    "anomaly_threshold": 0.2,
    "monthly_budget": 30000
  }
}
```

### Reading the output

Each anomaly entry tells you:
- `metric` — which metric changed
- `change_pct` — how much it changed (e.g. 0.38 = 38% increase)
- `root_cause` — the likely driver (see table below)
- `plain_english_explanation` — what this means in plain language
- `recommended_action` — what to do next
- `severity` — low / medium / high

### Root cause reference

| Root cause | What it means | What to do |
|---|---|---|
| `auction_pressure` | CPM up, CTR stable — competitors entered your auction | Test new audiences or placements |
| `creative_fatigue` | Frequency up, CTR down — audience is tuning out | Run `generate_creative_brief` immediately |
| `tracking_break` | Spend continues, purchases near zero — Pixel likely broken | Check Events Manager before anything else |
| `learning_phase_reset` | Volatile ROAS — campaign re-entered learning phase | Avoid edits for 7 days |
| `audience_saturation` | Reach shrinking, frequency climbing — audience exhausted | Expand targeting or test lookalikes |
| `offer_mismatch` | Strong CTR, weak purchase rate — landing page or offer problem | Use `100m-offers` skill, not ad creative |
| `budget_pacing` | Projected spend deviates from monthly budget | Run `get_spend_pacing` for full projection |

### When to invoke skills

- `creative_fatigue` or `auction_pressure` → proceed to Step 2 (`generate_creative_brief`)
- `offer_mismatch` → use the `100m-offers` skill to rebuild the offer before writing new ads
- `tracking_break` → stop. Fix tracking before spending more money.
- `budget_pacing` → proceed to Step 3 (`get_spend_pacing`) immediately

---

## Step 2: Generate Creative Brief

Run `generate_creative_brief` for any entity flagged with `creative_fatigue`, `auction_pressure`,
or `audience_saturation`. This tool finds your top-performing ads by ROAS and builds a
structured brief with three variation directions you can hand directly to a creator.

### Example call — brief from a campaign's top ads

```json
{
  "tool": "generate_creative_brief",
  "arguments": {
    "campaign_id": "123456789",
    "date_preset": "last_14d",
    "top_n": 3,
    "brand_context": "Eco-friendly reusable water bottles for gym-goers. Hero offer: buy 2 get 1 free + free shipping."
  }
}
```

### Example call — brief from a specific winning ad

```json
{
  "tool": "generate_creative_brief",
  "arguments": {
    "ad_id": "987654321",
    "date_preset": "last_14d",
    "brand_context": "Premium skincare for busy moms. 30-day money-back guarantee."
  }
}
```

### Reading the output

The brief contains:
- `winning_ads` — the top ads that drove the analysis, with their ROAS, CTR, and hook type
- `winning_pattern` — a plain-English summary of what made these ads work
- `brief` — exactly 3 variation directions, each with hook, format, angle, copy_direction, visual_direction
- `meta_specs` — character limits and format guidance for Meta placements
- `skill_context` — which skills to use and when
- `production_checklist` — what the creator needs before starting

### Executing the brief with the ad-creative skill

After receiving the brief output, invoke the `ad-creative` skill:

```text
Use the ad-creative skill.

Brief output:
[paste generate_creative_brief output]

Write ready-to-test ad copy for each of the 3 variation directions.
Follow the Meta specs in the brief. Deliver primary text, headline, and description for each.
```

### When to use 100m-offers instead

If `detect_anomalies` returned `offer_mismatch`, do NOT run `generate_creative_brief` yet.
The problem is the offer, not the creative. Use the `100m-offers` skill first:

```text
Use the 100m-offers skill.

The detect_anomalies tool flagged offer_mismatch:
- CTR is above 1.5% (people are clicking)
- Purchase rate is below 2% (people are not buying)

Brand context: [paste intake summary]
Current offer: [describe current offer]

Diagnose the offer using the value equation and rebuild it as a Grand Slam Offer.
```

---

## Step 3: Spend Pacing

Run `get_spend_pacing` to confirm the account is on track before making any budget decisions.
Always run this before recommending a scale action or budget increase.

### Example call

```json
{
  "tool": "get_spend_pacing",
  "arguments": {
    "monthly_budget": 30000,
    "gross_margin_pct": 0.4,
    "target_roas": 3.5
  }
}
```

With a custom date range:

```json
{
  "tool": "get_spend_pacing",
  "arguments": {
    "monthly_budget": 30000,
    "gross_margin_pct": 0.4,
    "time_range": {
      "since": "2026-05-01",
      "until": "2026-05-15"
    }
  }
}
```

### Reading the output

| Field | What it means |
|---|---|
| `pacing_status` | on_track / overpacing / underpacing / at_risk |
| `projected_month_spend` | Where you'll end up at current daily rate |
| `budget_remaining` | How much budget is left this month |
| `recommended_daily_budget` | What to set today to hit your monthly budget exactly |
| `breakeven_roas` | Minimum ROAS needed to break even at your margin |
| `projected_profit_loss` | Estimated month-end profit or loss at current ROAS |
| `cash_flow_warning` | Plain-English warning when overpacing or at_risk |

### Decision rules

- `on_track` → no budget action needed
- `underpacing` → consider whether to increase daily budget (requires owner approval)
- `overpacing` → reduce daily budget to `recommended_daily_budget` (requires owner approval)
- `at_risk` → already overspent; pause or reduce immediately (requires owner approval)

All budget changes require explicit owner approval per the Human Approval Policy.

---

## Full Workflow Example

```text
Agent: Run detect_anomalies for the last 14 days with monthly_budget=30000.

→ Output: creative_fatigue detected on campaign 123 (severity: high)
          budget_pacing detected (projected spend 42000 vs budget 30000)

Agent: Run generate_creative_brief for campaign 123 with brand_context.

→ Output: 3 variation directions based on top UGC ad (8.2x ROAS, 2.4% CTR)

Agent: Use ad-creative skill to write copy for each variation.

→ Output: 3 sets of ready-to-test ad copy

Agent: Run get_spend_pacing with monthly_budget=30000, gross_margin_pct=0.4.

→ Output: overpacing, recommended_daily_budget=850, cash_flow_warning present

Agent: Present owner with:
  1. Creative brief and new ad copy (ready to upload)
  2. Budget adjustment recommendation (requires approval)
  3. Cash flow projection
```

---

## Human Approval Reminder

This workflow produces recommendations and creative assets. No live changes are made.

Before acting on any recommendation:
- Budget changes → require explicit owner approval (see HUMAN_APPROVAL_POLICY.md)
- Pausing campaigns → require explicit owner approval
- Publishing new ads → require explicit owner approval

The workflow output is the brief. The owner decides what to do with it.
