import type { ColumnType, Generated } from 'kysely';
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';

type Timestamp = ColumnType<Date, Date | string | undefined, Date | string>;

export interface UsersTable {
  id: Generated<string>;
  legacy_id: string | null;
  email: string;
  username: string | null;
  name: string | null;
  provider: Generated<string>;
  role: Generated<string>;
  email_verified: Generated<boolean>;
  password_hash: string | null;
  avatar: string | null;
  tenant_id: string | null;
  /** Generated column (`coalesce(tenant_id, '')`); read-only. */
  tenant_key: ColumnType<string, never, never>;
  expires_at: Date | null;
  preferences: ColumnType<Record<string, unknown>, string | undefined, string>;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface UserIdentitiesTable {
  id: Generated<string>;
  user_id: string;
  provider: string;
  issuer: Generated<string>;
  provider_user_id: string;
  created_at: Timestamp;
}

export interface MigrationRejectsTable {
  id: Generated<string>;
  entity: string;
  legacy_id: string;
  reason: string;
  run_id: string | null;
  detail: ColumnType<Record<string, unknown>, string | undefined, string>;
  created_at: Timestamp;
}

export interface Database {
  users: UsersTable;
  user_identities: UserIdentitiesTable;
  migration_rejects: MigrationRejectsTable;
}

export type SslMode = 'disable' | 'require' | 'verify-full';

export interface PostgresConfig {
  databaseUrl?: string;
  poolMax?: number;
  sslMode?: SslMode;
}

/** Config errors never include the URL: it carries credentials. */
function assertUrl(databaseUrl: string | undefined): string {
  if (!databaseUrl?.trim()) {
    throw new Error('DATABASE_URL is required for PERSISTENCE_MODULE=postgres');
  }
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error('DATABASE_URL is not a valid connection URL');
  }
  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    throw new Error('DATABASE_URL must use the postgres:// or postgresql:// scheme');
  }
  return databaseUrl;
}

function sslOption(mode: SslMode | undefined): boolean | { rejectUnauthorized: boolean } {
  switch (mode) {
    case 'require':
      return { rejectUnauthorized: false };
    case 'verify-full':
      return { rejectUnauthorized: true };
    default:
      return false;
  }
}

/** Builds the Kysely handle over a `pg` pool (the pool is owned by, and closed with, the handle). */
export function createDb(config: PostgresConfig): Kysely<Database> {
  const connectionString = assertUrl(config.databaseUrl);
  const pool = new Pool({
    connectionString,
    max: config.poolMax ?? 10,
    ssl: config.sslMode ? sslOption(config.sslMode) : undefined,
  });
  // Idle-client errors would otherwise crash the process; the next query surfaces them.
  pool.on('error', () => undefined);
  return new Kysely<Database>({ dialect: new PostgresDialect({ pool }) });
}
