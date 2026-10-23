# ADR-0006: One-time offline cutover (MVP)

- Status: Accepted (see docs/architecture/solution.md §5, ADR-005)
- Date: 2026-10-23

## Decision
Stop writes, final delta pass, reconcile, flip PERSISTENCE_MODULE. Rollback is flipping back to read-only Mongo.

## Consequences
Downtime window required; dual-write deferred.
