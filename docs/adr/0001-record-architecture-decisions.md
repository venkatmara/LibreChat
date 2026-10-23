# ADR-0001: Record architecture decisions

- Status: Accepted
- Date: 2026-10-23

## Context
LCMIG makes long-lived design choices (ports and adapters, Kysely, ID strategy). They must stay discoverable.

## Decision
We record each significant decision as a numbered markdown file in `docs/adr/` (Context, Decision, Consequences). ADR-001..006 from `docs/architecture/solution.md` §5 are recorded here written as files `0002`-`0007` (architecture ADR-001..006).

## Consequences
Decisions are reviewed in PRs; superseded ADRs are marked, not deleted.
