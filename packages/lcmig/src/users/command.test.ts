import { createDb, runMigrations } from '@lcmig/persistence-postgres';
import mongoose from 'mongoose';
import { describeIfPg, createTestDatabase, startTestMongo } from '../test-support';
import type { TestDatabase } from '../test-support';
import { runUsersCommand } from './command';
import { userFixture } from './fixtures';

jest.setTimeout(180_000);

describe('lcmig users usage errors', () => {
  it('exits 2 on an unknown flag and on a missing MONGO_URI', async () => {
    expect((await runUsersCommand(['users', '--bogus'], {})).exitCode).toBe(2);
    const result = await runUsersCommand(['users'], { DATABASE_URL: 'postgres://u:secret@h/db' });
    expect(result.exitCode).toBe(2);
    expect(result.output).not.toContain('secret');
  });

  it('requires --entity users for reconcile', async () => {
    expect((await runUsersCommand(['reconcile'], {})).exitCode).toBe(2);
  });
});

describeIfPg('lcmig users copy and reconcile', () => {
  let mongo: Awaited<ReturnType<typeof startTestMongo>>;
  let database: TestDatabase;
  let env: NodeJS.ProcessEnv;
  const fixture = userFixture();

  async function seedMongo(): Promise<void> {
    const connection = await mongoose.createConnection(mongo.uri).asPromise();
    try {
      await connection.collection('users').deleteMany({});
      await connection.collection('users').insertMany(fixture.docs);
    } finally {
      await connection.close();
    }
  }

  async function pg<T>(fn: (db: ReturnType<typeof createDb>) => Promise<T>): Promise<T> {
    const db = createDb({ databaseUrl: database.url, poolMax: 2 });
    try {
      return await fn(db);
    } finally {
      await db.destroy();
    }
  }

  beforeEach(async () => {
    mongo = await startTestMongo();
    database = await createTestDatabase();
    env = { MONGO_URI: mongo.uri, DATABASE_URL: database.url };
    await pg((db) => runMigrations(db));
    await seedMongo();
  });

  afterEach(async () => {
    await database.drop();
    await mongo.stop();
  });

  const snapshot = () =>
    pg(async (db) => ({
      users: await db
        .selectFrom('users')
        .select(['legacy_id', 'email'])
        .orderBy('legacy_id')
        .execute(),
      identities: (await db.selectFrom('user_identities').selectAll().execute()).length,
      rejects: await db.selectFrom('migration_rejects').selectAll().orderBy('legacy_id').execute(),
    }));

  it('copies valid users, counts reconcile, checksums match (AC-17, AC-18)', async () => {
    const result = await runUsersCommand(['users', '--batch-size', '2'], env);
    expect(result.exitCode).toBe(0);
    const snap = await snapshot();
    expect(snap.users).toHaveLength(fixture.valid);
    expect(snap.identities).toBe(2);
    const report = JSON.parse(result.output.slice(0, result.output.indexOf('\n}') + 2));
    expect(report).toMatchObject({
      read: fixture.docs.length,
      written: fixture.valid,
      rejected: fixture.rejects,
      reconcile: { pgCount: fixture.valid, expectedCount: fixture.valid, ok: true },
    });
    expect(report.reconcile.checksumMismatches).toEqual([]);
  });

  it('records rejects by legacy_id and reason without values or hashes (AC-19)', async () => {
    await runUsersCommand(['users'], env);
    const { rejects } = await snapshot();
    expect(rejects.map((r) => [r.legacy_id.slice(-1), r.reason])).toEqual([
      ['5', 'conflict_email'],
      ['6', 'conflict_username'],
      ['7', 'missing_email'],
      ['8', 'malformed_email'],
      ['9', 'unsupported_two_factor'],
    ]);
    for (const r of rejects) {
      expect(r.run_id).toBeTruthy();
      expect(JSON.stringify(r)).not.toMatch(/example\.com|\$2a\$/);
    }
  });

  it('is idempotent on rerun (AC-20)', async () => {
    await runUsersCommand(['users'], env);
    const first = await snapshot();
    const result = await runUsersCommand(['users'], env);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('written=0');
    expect(await snapshot()).toEqual(first);
  });

  it('--dry-run writes nothing', async () => {
    const result = await runUsersCommand(['users', '--dry-run'], env);
    expect(result.exitCode).toBe(0);
    expect((await snapshot()).users).toHaveLength(0);
  });

  it('reports a checksum mismatch and exits 1 (AC-21)', async () => {
    await runUsersCommand(['users'], env);
    await pg((db) =>
      db
        .updateTable('users')
        .set({ role: 'ADMIN' })
        .where('email', '=', 'alice@example.com')
        .execute(),
    );
    const result = await runUsersCommand(['reconcile', '--entity', 'users'], env);
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('MISMATCH');
    expect(result.output).toContain('000000000000000000000001');
  });

  it('reports a count mismatch and exits 1 (AC-21)', async () => {
    await runUsersCommand(['users'], env);
    await pg((db) => db.deleteFrom('users').where('email', '=', 'bob@example.com').execute());
    const result = await runUsersCommand(['reconcile', '--entity', 'users'], env);
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('000000000000000000000002');
  });

  it('exits 2 without echoing the connection string on an unreachable database', async () => {
    const result = await runUsersCommand(['users'], {
      MONGO_URI: mongo.uri,
      DATABASE_URL: 'postgres://user:pw-secret@127.0.0.1:1/none',
    });
    expect(result.exitCode).toBe(2);
    expect(result.output).not.toContain('pw-secret');
  });
});
