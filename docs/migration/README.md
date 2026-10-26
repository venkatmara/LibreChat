# Migration runbook

The full cutover runbook, rollback plan and operator notes are still to come (architecture section 7 and ADR-005).

## Users slice (LCMIG-2)
1. Build: `npm ci && npm run build`.
2. Apply Postgres migrations (`runMigrations` from `@lcmig/persistence-postgres`); applied files are skipped.
3. Copy and reconcile: `node packages/lcmig/dist/cli.js users` with `MONGO_URI` and `DATABASE_URL` set. Use `--dry-run` to count without writing.
4. Re-check only: `node packages/lcmig/dist/cli.js reconcile --entity users`.
5. Read the report: `read`, `written`, `rejected`, `pgCount`, `expectedCount`, checksum mismatches. Exit 0 is clean, 1 is a mismatch (blocks cutover), 2 is a usage or runtime error. Rejects are in `migration_rejects`, identified by `legacy_id` and reason.

Details: [LCMIG-2 notes](../architecture/LCMIG-2.md).
