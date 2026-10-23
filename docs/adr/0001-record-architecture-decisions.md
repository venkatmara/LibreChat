# ADR-0001: Record architecture decisions

Status: Accepted

## Context

LCMIG makes several long-lived decisions (ports and adapters, Kysely, ID strategy, cutover). They need a durable, reviewable record.

## Decision

We keep ADRs as numbered markdown files in `docs/adr/`, one decision each, with Status, Context, Decision and Consequences. The decisions ADR-001 to ADR-006 in `docs/architecture/solution.md` section 5 are written up here as separate files as their slices start.

## Consequences

Decisions are reviewed in PRs and stay with the code. Superseded ADRs are marked, not deleted.
