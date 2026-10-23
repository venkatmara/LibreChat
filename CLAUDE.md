# CLAUDE.md - repository standards (AIDLC agents: follow this file first)

This file has the highest precedence over any other agent/contributing file in the repo.

## Stack

TypeScript 5 (strict) on Node.js 20, npm workspaces, Jest + ts-jest, ESLint 9 (flat) + typescript-eslint, Prettier 3. Postgres access will use Kysely + `pg` (ADR-002).

## Commands

- Install: `npm ci`
- Build: `npm run build` (tsc project references)
- Lint: `npm run lint` | Format: `npm run format` / `npm run format:check`
- Type check: `npm run typecheck` | Test: `npm test`

## Layout and conventions

- Workspaces: `packages/persistence-core`, `persistence-mongo`, `persistence-postgres`, `lcmig` only. `api/` is a placeholder, not a workspace.
- Services depend on ports only. `mongoose`/`mongodb` imports are allowed only in `persistence-mongo` and `lcmig` (ESLint-enforced, NFR-1).
- Ports use domain types, string IDs, cursor pagination, no Mongo concepts. IDs: UUIDv7 + `legacy_id` (ADR-004).
- Migrations are forward-only SQL in `packages/persistence-postgres/migrations`.
- Tests sit next to source as `*.test.ts`. No `any`, no non-null `!`. Never commit secrets; update `.env.example` for new config.
- Tooling scope is LCMIG code only; do not widen lint/format to LibreChat directories.
- Branches `LCMIG-<n>-<slug>`, Conventional Commits with ticket key, never commit to `main`.

## Definition of Done

Acceptance criteria met and traced to the ticket; tests added; lint, format:check, typecheck, test and build pass; docs/ADR updated; no secrets; PR template completed.
