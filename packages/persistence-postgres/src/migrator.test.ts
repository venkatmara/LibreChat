import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import { createDb } from './db';
import type { Database } from './db';
import { MIGRATIONS_DIR, runMigrations } from './migrator';
import { createTestDatabase, describeIfPg } from './test-support';
import type { TestDatabase } from './test-support';

jest.setTimeout(120_000);

async function withDb(fn: (db: Kysely<Database>, database: TestDatabase) => Promise<void>) {
  const database = await createTestDatabase();
  const db = createDb({ databaseUrl: database.url, poolMax: 2 });
  try {
    await fn(db, database);
  } finally {
    await db.destroy();
    await database.drop();
  }
}

async function pgCode(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
  } catch (err) {
    return (err as { code?: string }).code;
  }
  return undefined;
}

describeIfPg('migrations', () => {
  it('creates users and user_identities on an empty database (AC-12)', async () => {
    await withDb(async (db) => {
      await runMigrations(db);
      const tables = await sql<{ table_name: string }>`
        SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`.execute(db);
      const names = tables.rows.map((r) => r.table_name);
      assert.ok(names.includes('users') && names.includes('user_identities'));
      const cols = await sql<{ table_name: string; column_name: string }>`
        SELECT table_name, column_name FROM information_schema.columns
        WHERE table_schema = 'public'`.execute(db);
      const has = (t: string, c: string) =>
        cols.rows.some((r) => r.table_name === t && r.column_name === c);
      for (const c of ['legacy_id', 'tenant_key', 'preferences', 'password_hash']) {
        assert.ok(has('users', c), c);
      }
      assert.ok(has('user_identities', 'user_id'));
      assert.ok(has('migration_rejects', 'run_id') && has('migration_rejects', 'detail'));
    });
  });

  it('rejects duplicate email and username, allows other tenants and NULL usernames (AC-13)', async () => {
    await withDb(async (db) => {
      await runMigrations(db);
      await sql`INSERT INTO users (email, username) VALUES ('a@x.com', 'u1')`.execute(db);
      assert.equal(
        await pgCode(sql`INSERT INTO users (email) VALUES ('a@x.com')`.execute(db)),
        '23505',
      );
      assert.equal(
        await pgCode(sql`INSERT INTO users (email, username) VALUES ('b@x.com', 'u1')`.execute(db)),
        '23505',
      );
      await sql`INSERT INTO users (email, tenant_id) VALUES ('a@x.com', 't2')`.execute(db);
      await sql`INSERT INTO users (email) VALUES ('n1@x.com')`.execute(db);
      await sql`INSERT INTO users (email) VALUES ('n2@x.com')`.execute(db);
    });
  });

  it('generates UUIDv7 ids (AC-14)', async () => {
    await withDb(async (db) => {
      await runMigrations(db);
      const first = await sql<{ id: string }>`
        INSERT INTO users (email) VALUES ('v1@x.com') RETURNING id`.execute(db);
      await new Promise((r) => setTimeout(r, 5));
      const second = await sql<{ id: string }>`
        INSERT INTO users (email) VALUES ('v2@x.com') RETURNING id`.execute(db);
      const a = first.rows[0]?.id ?? '';
      const b = second.rows[0]?.id ?? '';
      for (const id of [a, b]) {
        assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      }
      assert.ok(a < b);
    });
  });

  it('enforces unique legacy_id but allows many NULLs (AC-15)', async () => {
    await withDb(async (db) => {
      await runMigrations(db);
      await sql`INSERT INTO users (email, legacy_id) VALUES ('l1@x.com', 'abc123')`.execute(db);
      assert.equal(
        await pgCode(
          sql`INSERT INTO users (email, legacy_id) VALUES ('l2@x.com', 'abc123')`.execute(db),
        ),
        '23505',
      );
      await sql`INSERT INTO users (email) VALUES ('l3@x.com')`.execute(db);
      await sql`INSERT INTO users (email) VALUES ('l4@x.com')`.execute(db);
    });
  });

  it('rerunning migrations is a no-op (AC-16)', async () => {
    await withDb(async (db) => {
      const first = await runMigrations(db);
      assert.equal(
        first.applied.length,
        (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).length,
      );
      await sql`INSERT INTO users (email) VALUES ('r@x.com')`.execute(db);
      const snapshot = async () =>
        (
          await sql<{ table_name: string; column_name: string }>`
            SELECT table_name, column_name FROM information_schema.columns
            WHERE table_schema = 'public' ORDER BY 1, 2`.execute(db)
        ).rows;
      const history = () => sql`SELECT name FROM kysely_migration ORDER BY name`.execute(db);
      const before = [await snapshot(), (await history()).rows];
      const second = await runMigrations(db);
      assert.deepEqual(second.applied, []);
      assert.deepEqual([await snapshot(), (await history()).rows], before);
      const count = await sql<{ n: string }>`SELECT count(*) AS n FROM users`.execute(db);
      assert.equal(count.rows[0]?.n, '1');
    });
  });

  it('0003 de-duplicates pre-existing migration_rejects before adding the constraint', async () => {
    await withDb(async (db) => {
      const partial = await mkdtemp(path.join(os.tmpdir(), 'lcmig-mig-'));
      for (const f of ['0001_init.sql', '0002_users.sql']) {
        await writeFile(path.join(partial, f), await readFile(path.join(MIGRATIONS_DIR, f)));
      }
      await runMigrations(db, partial);
      await sql`INSERT INTO migration_rejects (entity, legacy_id, reason)
        VALUES ('users', 'x', 'r1'), ('users', 'x', 'r2'), ('users', 'y', 'r1')`.execute(db);
      await runMigrations(db);
      const rows = await sql<{ legacy_id: string; reason: string }>`
        SELECT legacy_id, reason FROM migration_rejects ORDER BY legacy_id`.execute(db);
      assert.deepEqual(rows.rows, [
        { legacy_id: 'x', reason: 'r1' },
        { legacy_id: 'y', reason: 'r1' },
      ]);
    });
  });
});
