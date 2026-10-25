import { randomBytes } from 'node:crypto';
import { Pool } from 'pg';

/** Admin URL for a throwaway Postgres (CI service or local container); tests skip when unset. */
export const TEST_PG_URL = process.env.PG_TEST_URL;

export const describeIfPg: jest.Describe = TEST_PG_URL ? describe : describe.skip;

export interface TestDatabase {
  url: string;
  drop(): Promise<void>;
}

/** Creates an empty, uniquely named database on the test server. */
export async function createTestDatabase(): Promise<TestDatabase> {
  if (!TEST_PG_URL) throw new Error('PG_TEST_URL is not set');
  const name = `lcmig_test_${process.pid}_${randomBytes(4).toString('hex')}`;
  const admin = new Pool({ connectionString: TEST_PG_URL, max: 1 });
  try {
    await admin.query(`CREATE DATABASE ${name}`);
  } finally {
    await admin.end();
  }
  const url = new URL(TEST_PG_URL);
  url.pathname = `/${name}`;
  return {
    url: url.toString(),
    drop: async () => {
      const pool = new Pool({ connectionString: TEST_PG_URL, max: 1 });
      try {
        await pool.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      } finally {
        await pool.end();
      }
    },
  };
}
