import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { Migrator, sql } from 'kysely';
import type { Kysely, Migration, MigrationProvider } from 'kysely';
import type { Database } from './db';

/** `src/` and `dist/` both sit next to `migrations/`. */
export const MIGRATIONS_DIR = path.resolve(__dirname, '..', 'migrations');

/** Reads forward-only `NNNN_name.sql` files; each runs as one multi-statement script. */
export class SqlFileMigrationProvider implements MigrationProvider {
  constructor(private readonly dir: string = MIGRATIONS_DIR) {}

  async getMigrations(): Promise<Record<string, Migration>> {
    const files = (await readdir(this.dir)).filter((f) => f.endsWith('.sql')).sort();
    const migrations: Record<string, Migration> = {};
    for (const file of files) {
      const script = await readFile(path.join(this.dir, file), 'utf8');
      migrations[file.replace(/\.sql$/, '')] = {
        up: async (db) => {
          await sql.raw(script).execute(db);
        },
      };
    }
    return migrations;
  }
}

export interface MigrationOutcome {
  applied: string[];
}

/**
 * Applies pending migrations in order; already-applied ones are skipped (AC-16).
 * Kysely holds a lock row while running, so concurrent callers do not double-apply.
 */
export async function runMigrations(db: Kysely<Database>, dir?: string): Promise<MigrationOutcome> {
  const migrator = new Migrator({ db, provider: new SqlFileMigrationProvider(dir) });
  const { error, results } = await migrator.migrateToLatest();
  if (error) {
    const failed = results?.find((r) => r.status === 'Error');
    throw new Error(`Migration ${failed?.migrationName ?? ''} failed`.trim(), { cause: error });
  }
  return {
    applied: (results ?? []).filter((r) => r.status === 'Success').map((r) => r.migrationName),
  };
}
