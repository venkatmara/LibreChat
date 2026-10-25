import type { Selectable } from 'kysely';
import type { UserAuthRecord, UserIdentity, UserRecord } from '@lcmig/persistence-core';
import type { UserIdentitiesTable, UsersTable } from './db';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

export function normalizeEmail(email: unknown): string {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

/** Empty usernames are stored as NULL so they never collide. */
export function normalizeUsername(username: string | null | undefined): string | null {
  const value = (username ?? '').trim().toLowerCase();
  return value === '' ? null : value;
}

export type UserRow = Selectable<UsersTable>;
export type IdentityRow = Selectable<UserIdentitiesTable>;

export function toIdentity(row: IdentityRow): UserIdentity {
  return {
    provider: row.provider,
    issuer: row.issuer === '' ? null : row.issuer,
    providerUserId: row.provider_user_id,
  };
}

/** Row to domain record (no hash). Shared with lcmig so both sides compute checksums identically. */
export function toUserRecord(row: UserRow, identities: IdentityRow[]): UserRecord {
  const sorted = [...identities].sort(
    (a, b) =>
      a.provider.localeCompare(b.provider) ||
      a.issuer.localeCompare(b.issuer) ||
      a.provider_user_id.localeCompare(b.provider_user_id),
  );
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    name: row.name,
    provider: row.provider,
    role: row.role,
    emailVerified: row.email_verified,
    tenantId: row.tenant_id,
    avatar: row.avatar,
    expiresAt: row.expires_at,
    identities: sorted.map(toIdentity),
    preferences: row.preferences,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toUserAuthRecord(row: UserRow, identities: IdentityRow[]): UserAuthRecord {
  return { ...toUserRecord(row, identities), passwordHash: row.password_hash };
}
