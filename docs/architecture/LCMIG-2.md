# LCMIG-2: walking skeleton (users slice)

Implementation notes for LCMIG-2. The system-level design is in [solution.md](solution.md). This page records what the slice does and where it deviates.

## What the slice covers
- `UserRepo` port in `persistence-core`, selected by `PERSISTENCE_MODULE` (unset or empty gives `mongo`, logged with `source=default`; an unknown value fails startup and lists the allowed names).
- Mongo adapter and Postgres adapter (Kysely + `pg`), both run by the shared contract kit `runUserRepoContract`.
- Forward-only migrations `0002_users.sql` (`users`, `user_identities`, DB-side UUIDv7, unique `legacy_id`) and `0003_migration_rejects_detail.sql`.
- `lcmig users` (copy and reconcile) and `lcmig reconcile --entity users`.
- `lcmig audit-check` against the committed audit file.

## Audit file format (AC-1..3)
`docs/audit/mongo-collections.json`, machine-checked:

```json
{ "version": 1, "collections": [
  { "collection": "users", "model": "User", "schemaFile": "packages/data-schemas/src/models/user.ts",
    "services": ["api/strategies/localStrategy.js"], "slice": "users" } ] }
```

- `slice` is `users` for the migrated slice and `pending` for everything else.
- `audit-check` discovers collection names statically from `packages/data-schemas/src/models/*.ts`. It exits 1 and names collections that are missing from the file or stale in it, and listed service paths that do not exist. It exits 0 otherwise.
- The audit holds paths only: no secrets, hashes or data.

## Checksum field set (A-3)
`checksumView` in `packages/lcmig/src/mappings/users.ts` is the single function used for both the Mongo-mapped value and the row read back from Postgres. The checksum is `sha256` over canonical JSON (sorted keys) of:

`email`, `username`, `name`, `provider`, `role`, `emailVerified`, `tenantId`, `avatar`, `expiresAt`, `createdAt`, `updatedAt` (timestamps as UTC epoch ms), `passwordHash`, `preferences`, and `identities` (`provider`, `issuer`, `providerUserId`, sorted).

`id` is excluded because it differs by design (UUIDv7 vs Mongo `_id`; the `_id` lives in `legacy_id`). Reconcile joins rows on `legacy_id`.

## Copy and reconcile behaviour
- Idempotent: rows are inserted with `ON CONFLICT (legacy_id) DO NOTHING`, so a rerun skips existing rows (A-5). Source changes are not propagated.
- Reject reasons: `missing_email`, `malformed_email`, `unsupported_two_factor`, `invalid_timestamp`, `conflict_email`, `conflict_username`, `conflict_other`. A reject is stored in `migration_rejects` with `entity`, `legacy_id`, `reason`, `run_id` and `detail` (field names only; never hashes, emails or values). `(entity, legacy_id)` is unique, so reruns do not duplicate rejects.
- Not copied in this slice: `refreshToken[]`, 2FA secrets and backup codes, `credentialsChangedAt`, terms fields. Users with two-factor enabled are rejected so nothing is silently dropped.
- Count rule (A-4): Postgres rows = Mongo documents - rejects. The report states read, written, rejected, `pgCount`, `expectedCount` and checksum mismatches.
- Exit codes: 0 clean, 1 reconcile mismatch, 2 usage or runtime error. Connection strings are never printed.

## Deviations from the approved architecture
- The audit `schemaFile` and discovery use `packages/data-schemas/src/models/*.ts` (static scan) rather than enumerating `createModels(mongoose)` at runtime, so `audit-check` does not need a built `@librechat/data-schemas`.
- `lcmig` sources live under `packages/lcmig/src/mappings/` and `src/users/` (not a top-level `mappings/` directory).
- ADRs 0008 to 0012 referenced by the architecture are not committed in `docs/adr/`; this page is the record for the slice until they are added.

## Run commands
```bash
npm ci && npm run build
npm run audit:check                                    # AC-1..3
DATABASE_URL=... MONGO_URI=... node packages/lcmig/dist/cli.js users [--batch-size N] [--dry-run]
DATABASE_URL=... MONGO_URI=... node packages/lcmig/dist/cli.js reconcile --entity users
PERSISTENCE_MODULE=postgres DATABASE_URL=... <start app>   # login on Postgres
```
Tests need `MONGO_URI` and `DATABASE_URL` for the integration suites (CI provides service containers in `.github/workflows/lcmig.yml`).
