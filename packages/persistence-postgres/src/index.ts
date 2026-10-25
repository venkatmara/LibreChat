import type { PersistenceModule } from '@lcmig/persistence-core';
import { sql } from 'kysely';
import { createDb } from './db';
import type { PostgresConfig } from './db';
import { PostgresUserRepo } from './user-repo';

/** Postgres adapter; fails fast on a missing or malformed `databaseUrl` (never echoed). */
export function createPostgresModule(config: PostgresConfig): PersistenceModule {
  const db = createDb(config);
  return {
    name: 'postgres',
    users: new PostgresUserRepo(db),
    health: async () => {
      try {
        await sql`select 1`.execute(db);
        return { ok: true, adapter: 'postgres' };
      } catch {
        return { ok: false, adapter: 'postgres' };
      }
    },
    close: async () => {
      await db.destroy();
    },
  };
}

export { createDb } from './db';
export type { Database, PostgresConfig, SslMode } from './db';
export { mapPgError } from './errors';
export { MIGRATIONS_DIR, SqlFileMigrationProvider, runMigrations } from './migrator';
export type { MigrationOutcome } from './migrator';
export { PostgresUserRepo } from './user-repo';
export { toUserAuthRecord, toUserRecord } from './user-mapper';
export type { IdentityRow, UserRow } from './user-mapper';
