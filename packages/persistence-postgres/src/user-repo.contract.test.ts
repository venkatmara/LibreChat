import assert from 'node:assert/strict';
import { runUserRepoContract } from '@lcmig/persistence-core';
import { sql } from 'kysely';
import { createDb } from './db';
import { createPostgresModule } from './index';
import { runMigrations } from './migrator';
import { createTestDatabase, describeIfPg, TEST_PG_URL } from './test-support';

jest.setTimeout(120_000);

if (TEST_PG_URL) {
  runUserRepoContract('postgres', async () => {
    const database = await createTestDatabase();
    const migrationDb = createDb({ databaseUrl: database.url, poolMax: 1 });
    await runMigrations(migrationDb);
    await migrationDb.destroy();
    const mod = createPostgresModule({ databaseUrl: database.url });
    const resetDb = createDb({ databaseUrl: database.url, poolMax: 1 });
    return {
      users: mod.users,
      reset: async () => {
        await sql`TRUNCATE users CASCADE`.execute(resetDb);
      },
      teardown: async () => {
        await resetDb.destroy();
        await mod.close();
        await database.drop();
      },
    };
  });
}

describeIfPg('postgres adapter port hygiene', () => {
  it('returns plain objects with string ids and no hash outside getAuthByEmail', async () => {
    const database = await createTestDatabase();
    const db = createDb({ databaseUrl: database.url, poolMax: 1 });
    await runMigrations(db);
    const mod = createPostgresModule({ databaseUrl: database.url });
    try {
      const created = await mod.users.create({ email: 'p@example.com', passwordHash: 'h-1' });
      assert.equal(typeof created.id, 'string');
      assert.equal(Object.getPrototypeOf(created), Object.prototype);
      assert.ok(!('passwordHash' in created) && !('password_hash' in created));
      assert.deepEqual(await mod.health(), { ok: true, adapter: 'postgres' });
    } finally {
      await mod.close();
      await db.destroy();
      await database.drop();
    }
  });
});
