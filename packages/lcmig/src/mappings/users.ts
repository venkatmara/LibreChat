import { createHash } from 'node:crypto';
import { toUserRecord } from '@lcmig/persistence-mongo';
import type { MongoUserDoc } from '@lcmig/persistence-mongo';
import type { UserRecord } from '@lcmig/persistence-core';

export const USERS_ENTITY = 'users';

export type RejectReason =
  | 'missing_email'
  | 'malformed_email'
  | 'unsupported_two_factor'
  | 'invalid_timestamp'
  | 'conflict_email'
  | 'conflict_username'
  | 'conflict_other';

/** Source document as read from Mongo (lean). Only the fields this slice reads are typed. */
export type SourceUserDoc = MongoUserDoc & { twoFactorEnabled?: boolean };

export interface MappedUser {
  legacyId: string;
  record: UserRecord;
  passwordHash: string | null;
}

export type MapResult =
  | { ok: true; user: MappedUser }
  | { ok: false; legacyId: string; reason: RejectReason; fields: string[] };

const EMAIL_RE = /^\S+@\S+\.\S+$/;

function isDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

/** Pure Mongo-document to Postgres-shaped mapping; invalid documents become rejects (field names only). */
export function mapUser(doc: SourceUserDoc): MapResult {
  const legacyId = doc._id.toString();
  const reject = (reason: RejectReason, fields: string[]): MapResult => ({
    ok: false,
    legacyId,
    reason,
    fields,
  });
  if (doc.twoFactorEnabled === true) return reject('unsupported_two_factor', ['twoFactorEnabled']);
  const email = typeof doc.email === 'string' ? doc.email.trim().toLowerCase() : '';
  if (!email) return reject('missing_email', ['email']);
  if (!EMAIL_RE.test(email)) return reject('malformed_email', ['email']);
  if (!isDate(doc.createdAt) || !isDate(doc.updatedAt)) {
    return reject('invalid_timestamp', ['createdAt', 'updatedAt']);
  }
  const base = toUserRecord({ ...doc, email });
  const username = (base.username ?? '').trim().toLowerCase();
  const record: UserRecord = {
    ...base,
    username: username === '' ? null : username,
    // '' and null collide in tenant_key, so they are one value on both sides.
    tenantId: base.tenantId === '' ? null : base.tenantId,
    // Normalise BSON leftovers (ObjectId, Date) to plain JSON as Postgres JSONB will return them.
    preferences: JSON.parse(JSON.stringify(base.preferences)) as Record<string, unknown>,
  };
  const passwordHash =
    typeof doc.password === 'string' && doc.password !== '' ? doc.password : null;
  return { ok: true, user: { legacyId, record, passwordHash } };
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      out[key] = canonical((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

const ms = (d: Date | null): number | null => (d ? d.getTime() : null);

/**
 * Per-row checksum (ADR-0011): sha256 over canonical JSON of the scalar fields (timestamps as UTC
 * epoch ms, password hash included) plus the sorted identities. `id` is excluded (differs by design).
 * Both the Mongo and the Postgres side call this one function.
 */
export function checksumView(record: UserRecord, passwordHash: string | null): string {
  const identities = record.identities
    .map((i) => ({
      provider: i.provider,
      issuer: i.issuer ?? null,
      providerUserId: i.providerUserId,
    }))
    .sort(
      (a, b) =>
        a.provider.localeCompare(b.provider) ||
        (a.issuer ?? '').localeCompare(b.issuer ?? '') ||
        a.providerUserId.localeCompare(b.providerUserId),
    );
  const view = {
    email: record.email,
    username: record.username,
    name: record.name,
    provider: record.provider,
    role: record.role,
    emailVerified: record.emailVerified,
    tenantId: record.tenantId,
    avatar: record.avatar,
    expiresAt: ms(record.expiresAt),
    createdAt: ms(record.createdAt),
    updatedAt: ms(record.updatedAt),
    passwordHash,
    preferences: record.preferences,
    identities,
  };
  return createHash('sha256')
    .update(JSON.stringify(canonical(view)))
    .digest('hex');
}
