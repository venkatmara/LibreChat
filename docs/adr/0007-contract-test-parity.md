# ADR-0007: Contract-test-driven parity

- Status: Accepted (see docs/architecture/solution.md §5, ADR-006)
- Date: 2026-10-23

## Decision
One test kit parameterised over adapters covers ordering, pagination, uniqueness errors, transactions, null/default handling.

## Consequences
Both adapters must pass 100%.
