# Human Approval Policy

## Purpose

The agency harness may analyze data, prepare recommendations, and draft changes.

It must not silently change live ad spend, delivery, targeting, or published creative.

## Safe Without Approval

The model can do these without explicit owner approval:

- Ask intake questions.
- Summarize brand context.
- Research public competitors.
- Draft offers.
- Draft ad copy.
- Draft creative briefs.
- Analyze Meta Ads data.
- Diagnose performance.
- Recommend actions.
- Create a proposed campaign structure.
- Create a launch checklist.
- Flag risk.

## Requires Owner Approval

The model must ask for clear approval before:

- Publishing a campaign.
- Publishing an ad set.
- Publishing an ad.
- Pausing a campaign.
- Pausing an ad set.
- Pausing an ad.
- Increasing budget.
- Decreasing budget.
- Editing campaign objective.
- Editing attribution settings.
- Editing audience targeting.
- Editing placements.
- Editing optimization event.
- Editing a live offer or landing page if it affects paid traffic.

## Approval Prompt Format

Use this format:

```text
I recommend this action, but it changes live ad delivery or spend, so I need your approval first.

Action:
Entity:
Current state:
Proposed change:
Reason:
Expected upside:
Risk:
Rollback plan:

Please reply with "approve" if you want me to proceed.
```

## Approval Must Be Specific

Do not treat vague agreement as approval.

Not enough:

```text
Sounds good.
Go ahead with the plan.
Looks fine.
```

Enough:

```text
Approve increasing ad set 123 daily budget from 1000 INR to 1200 INR.
Approve pausing campaign 456.
Approve publishing the draft campaign named META_Sales_Broad_CoreOffer_2026M05.
```

## Budget Safety Rules

Default rules:

- Never increase daily budget by more than 20 percent in one recommendation unless the owner explicitly asks for aggressive scaling.
- Never increase budget if purchase tracking is broken.
- Never increase budget if inventory is unknown and the campaign is already producing sales.
- Never scale based only on CTR.
- Never pause a campaign only because one day was weak.
- Avoid major edits during Meta learning phase unless spend safety is at risk.

## Write Tool Requirements

Any future write MCP tool must require:

```json
{
  "approval_id": "string",
  "approved_by": "owner",
  "approved_at": "ISO-8601 timestamp",
  "approval_text": "Exact owner approval message",
  "requires_human_approval": true
}
```

Write tool responses must include:

```json
{
  "changed": true,
  "entity_type": "campaign",
  "entity_id": "123",
  "previous_state": {},
  "new_state": {},
  "rollback_hint": "What to do if the owner wants to undo this."
}
```

## No Autonomous Spend Rule

The harness must never autonomously spend money.

Even if the model is confident, it should prepare the decision and ask the owner to approve.

## Emergency Exception

If a campaign appears to be spending unexpectedly because of a tracking or setup issue, the model can strongly recommend pausing immediately, but it still needs owner approval before using a write tool.

If no write tool exists, the model should give step-by-step instructions for the owner to pause manually in Meta Ads Manager.
