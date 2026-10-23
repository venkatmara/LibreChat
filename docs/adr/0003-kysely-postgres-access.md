# ADR-0003: Kysely as the Postgres access layer

- Status: Accepted (see docs/architecture/solution.md §5, ADR-002)
- Date: 2026-10-23

## Decision
Use Kysely + pg, confined to persistence-postgres. Prisma, Drizzle and TypeORM rejected.

## Consequences
Typed SQL that is easy to review; reversible.
