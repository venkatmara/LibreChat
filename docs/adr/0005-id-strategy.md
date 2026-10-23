# ADR-0005: ID strategy

- Status: Accepted (see docs/architecture/solution.md §5, ADR-004)
- Date: 2026-10-23

## Decision
New UUIDv7 id per row, original Mongo _id in unique indexed legacy_id; business keys kept as unique columns; ports expose opaque string IDs.

## Consequences
Idempotent reruns via INSERT ... ON CONFLICT (legacy_id).
