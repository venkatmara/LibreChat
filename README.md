# LCMIG – LibreChat MongoDB → PostgreSQL persistence layer

Jira project LCMIG. Introduces a ports-and-adapters persistence module (`persistence-core`, `persistence-mongo`, `persistence-postgres`) and the `lcmig` migration CLI (profile → extract → transform → load → reconcile → report). Currently a healthy skeleton: each package has a minimal implementation and one passing test.

## Prerequisites

Node.js >= 20, npm >= 9. (Docker is needed later for Testcontainers contract tests.)

## Setup

```
npm ci
cp .env.example .env
```

## Run

```
npm run build
node dist/packages/lcmig/src/index.js profile
```

## Test and quality

```
npm run lint && npm run format:check
npm run typecheck
npm test
```

## Structure

- `packages/persistence-core` – ports, errors, registry (contract-test kit to come)
- `packages/persistence-mongo` – Mongo adapter
- `packages/persistence-postgres` – Postgres adapter and `migrations/`
- `packages/lcmig` – migration CLI and `mappings/`
- `api/` – services refactored to depend on ports only (LibreChat code lands here)
- `docs/` – `project/scope.md`, `architecture/solution.md`, `adr/`, `persistence/`, `migration/`

See [scope](docs/project/scope.md), [architecture](docs/architecture/solution.md), [ADRs](docs/adr/), [CONTRIBUTING](CONTRIBUTING.md).
