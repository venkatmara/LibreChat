# CLAUDE.md – repository standards

AIDLC agents: follow this file first; it overrides generic AIDLC standards.

## Stack

TypeScript 5 (strict) on Node.js 20, npm workspaces monorepo, Jest + ts-jest, ESLint 9 (flat config) + typescript-eslint, Prettier. Planned: Kysely + `pg`, Testcontainers.

## Commands

- Install: `npm ci`
- Lint: `npm run lint`; format: `npm run format` (check: `npm run format:check`)
- Type check: `npm run typecheck`
- Test: `npm test`
- Build: `npm run build`

## Layout

`packages/persistence-core` (ports, errors, registry), `packages/persistence-mongo`, `packages/persistence-postgres` (`migrations/`), `packages/lcmig` (`mappings/`), `api/`, `docs/`. Packages import each other as `@lcmig/<name>`. Tests sit next to source as `*.test.ts`.

## Conventions

- Ports use domain types, opaque string IDs, cursor pagination, explicit transactions; no Mongo concepts.
- Only `persistence-mongo` (and the `lcmig` extract stage) may import `mongoose`/`mongodb`.
- Errors map to `PortError` kinds: NotFound, Conflict, ConstraintViolation, Transient.
- Postgres: snake_case, `timestamptz`, UUIDv7 `id` + `legacy_id`, forward-only numbered SQL migrations.
- No `any`; no secrets in code, logs, fixtures or reject reports.
- Architecture: `docs/architecture/solution.md`; scope: `docs/project/scope.md`; decisions in `docs/adr/`.

## Definition of Done

Lint, format check, type check and tests pass; behaviour changes have tests; contract tests pass for affected ports on both adapters; docs/ADR updated; PR references the LCMIG key and ACs.
