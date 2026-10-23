# LCMIG: LibreChat MongoDB to PostgreSQL migration

LCMIG delivers a module-based persistence layer for LibreChat (ports in `persistence-core`, a Mongo adapter, a Postgres adapter) and the `lcmig` CLI that migrates data from MongoDB to PostgreSQL. See [scope](docs/project/scope.md) and [solution architecture](docs/architecture/solution.md).

## Prerequisites

Node.js >= 20 and npm >= 9. (Docker will be needed later for Testcontainers-based tests.)

## Setup, run, test

```bash
npm ci
cp .env.example .env     # placeholders only; never commit .env
npm run build
node packages/lcmig/dist/cli.js --help
npm run lint && npm run format:check && npm run typecheck && npm test
```

## Structure

```
packages/persistence-core      ports, domain types, errors, registry, contract-test kit
packages/persistence-mongo     adapter over existing Mongoose models
packages/persistence-postgres  Kysely adapter; migrations/ holds versioned SQL
packages/lcmig                 migration CLI; mappings/ holds per-entity mappings
api/                           placeholder (see below)
docs/                          project, architecture, adr, persistence, migration
```

Only these four packages are npm workspaces. Lint, format and typecheck are scoped to `packages/` (plus Prettier on docs and root configs).

## Relationship to LibreChat `api/`

The upstream LibreChat repository has its own `api/` directory (the Express backend) whose services will be refactored to depend on persistence ports only. In this repository `api/` is only a placeholder marking where that refactor lands when LCMIG code is merged into a LibreChat checkout. The LibreChat `api/`, `client/` and `packages/*` (data-provider, data-schemas, etc.) are not part of this scaffold: they are not workspaces and not covered by LCMIG CI. When integrating into LibreChat, keep the LCMIG workspace list and tooling scope as they are, and apply the NFR-1 import rule to the real `api/`.

## Manual step: branch protection

Branch protection could not be applied from this scaffold (no remote/token). A repo admin must configure `main`: require a pull request with 1 approving review, require the `ci` status check, block force pushes and deletions. Also replace the placeholder handles in `.github/CODEOWNERS` with real owners.

See [CONTRIBUTING.md](CONTRIBUTING.md) and [CLAUDE.md](CLAUDE.md).
