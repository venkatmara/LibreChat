import { randomBytes } from 'node:crypto';
import { createDb } from '@lcmig/persistence-postgres';
import { sql } from 'kysely';

/** Admin URL for a throwaway Postgres (CI service or local container); DB tests skip when unset. */
export const TEST_PG_URL = process.env.PG_TEST_URL;

export const describeIfPg: jest.Describe = TEST_PG_URL ? describe : describe.skip;

export interface TestDatabase {
  url: string;
  drop(): Promise<void>;
}

async function admin(statement: string): Promise<void> {
  const db = createDb({ databaseUrl: TEST_PG_URL, poolMax: 1 });
  try {
    await sql.raw(statement).execute(db);
  } finally {
    await db.destroy();
  }
}

export async function createTestDatabase(): Promise<TestDatabase> {
  if (!TEST_PG_URL) throw new Error('PG_TEST_URL is not set');
  const name = `lcmig_cli_test_${process.pid}_${randomBytes(4).toString('hex')}`;
  await admin(`CREATE DATABASE ${name}`);
  const url = new URL(TEST_PG_URL);
  url.pathname = `/${name}`;
  return { url: url.toString(), drop: () => admin(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`) };
}

export async function startTestMongo(): Promise<{ uri: string; stop(): Promise<void> }> {
  const dbName = `lcmig_cli_test_${process.pid}_${Date.now()}`;
  if (process.env.MONGO_URI) {
    const url = new URL(process.env.MONGO_URI);
    url.pathname = `/${dbName}`;
    return { uri: url.toString(), stop: async () => undefined };
  }
  const { MongoMemoryServer } = await import('mongodb-memory-server');
  const server = await MongoMemoryServer.create();
  return {
    uri: `${server.getUri()}${dbName}`,
    stop: async () => {
      await server.stop();
    },
  };
}
