# ADR-0004: Hybrid relational/JSONB model

- Status: Accepted (see docs/architecture/solution.md §5, ADR-003)
- Date: 2026-10-23

## Decision
Stable, queried fields become columns with constraints; schemaless provider blobs become JSONB.

## Consequences
Queried or filtered JSONB fields must be promoted to columns.
