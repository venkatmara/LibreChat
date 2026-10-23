# ADR-0002: Ports-and-adapters persistence module

- Status: Accepted (see docs/architecture/solution.md §5, ADR-001)
- Date: 2026-10-23

## Decision
A core package of interfaces with one adapter per database, selected by config (PERSISTENCE_MODULE). Direct Mongoose-to-ORM replacement is rejected.

## Consequences
Up-front refactor; yields a swappable layer.
