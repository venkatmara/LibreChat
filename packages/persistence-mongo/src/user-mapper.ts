import { PortError } from '@lcmig/persistence-core';
import type { NewUser, UserIdentity, UserPatch, UserRecord } from '@lcmig/persistence-core';

/** Lean Mongo user document: only the fields this slice reads. */
export interface MongoUserDoc {
  _id: { toString(): string };
  email: string;
  username?: string | null;
  name?: string | null;
  provider?: string;
  role?: string;
  emailVerified?: boolean;
  tenantId?: string | null;
  avatar?: string | null;
  expiresAt?: Date | null;
  password?: string | null;
  openidIssuer?: string | null;
  plugins?: unknown[];
  personalization?: Record<string, unknown> | null;
  favorites?: unknown[];
  pinnedOrder?: string[];
  skillStates?: Record<string, boolean> | null;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: unknown;
}

/** Identity providers stored as `<provider>Id` fields on the Mongo user. */
const IDENTITY_PROVIDERS = [
  'google',
  'facebook',
  'openid',
  'saml',
  'ldap',
  'github',
  'discord',
  'apple',
] as const;

const PREFERENCE_KEYS = ['personalization', 'favorites', 'pinnedOrder', 'skillStates', 'plugins'];
const PERSONALIZATION_DEFAULTS: Record<string, unknown> = {
  memories: true,
  statefulCodeEnvironment: 'user',
};

const OBJECT_ID = /^[0-9a-f]{24}$/i;

export function isObjectIdString(id: string): boolean {
  return OBJECT_ID.test(id);
}

export function normalizeEmail(email: unknown): string {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

export function normalizeUsername(username: string | null | undefined): string {
  return (username ?? '').trim().toLowerCase();
}

function extractIdentities(doc: MongoUserDoc): UserIdentity[] {
  const identities: UserIdentity[] = [];
  for (const provider of IDENTITY_PROVIDERS) {
    const value = doc[`${provider}Id`];
    if (typeof value === 'string' && value !== '') {
      identities.push({
        provider,
        issuer: provider === 'openid' ? (doc.openidIssuer ?? null) : null,
        providerUserId: value,
      });
    }
  }
  return identities;
}

/** Default-valued preferences are omitted so both adapters expose the same shape. */
function extractPreferences(doc: MongoUserDoc): Record<string, unknown> {
  const prefs: Record<string, unknown> = {};
  const p: Record<string, unknown> = { ...doc.personalization };
  delete p._id;
  if (Object.keys(p).some((k) => p[k] !== PERSONALIZATION_DEFAULTS[k])) {
    prefs.personalization = p;
  }
  if (doc.favorites?.length) prefs.favorites = doc.favorites;
  if (doc.pinnedOrder?.length) prefs.pinnedOrder = doc.pinnedOrder;
  if (doc.skillStates && Object.keys(doc.skillStates).length) prefs.skillStates = doc.skillStates;
  if (doc.plugins?.length) prefs.plugins = doc.plugins;
  return prefs;
}

/** Maps `_id` to a string `id`; the password hash is never included. */
export function toUserRecord(doc: MongoUserDoc): UserRecord {
  return {
    id: doc._id.toString(),
    email: doc.email,
    username: doc.username ? doc.username : null,
    name: doc.name ?? null,
    provider: doc.provider ?? 'local',
    role: doc.role ?? 'USER',
    emailVerified: doc.emailVerified ?? false,
    tenantId: doc.tenantId ?? null,
    avatar: doc.avatar ?? null,
    expiresAt: doc.expiresAt ?? null,
    identities: extractIdentities(doc),
    preferences: extractPreferences(doc),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export interface MongoWrite {
  set: Record<string, unknown>;
  unset: string[];
}

function assign(w: MongoWrite, field: string, value: unknown): void {
  if (value === null) {
    w.unset.push(field);
  } else if (value !== undefined) {
    w.set[field] = value;
  }
}

/** Translates a port create/update input into `$set` / `$unset` parts (undefined = untouched). */
export function toMongoWrite(input: NewUser | UserPatch): MongoWrite {
  const w: MongoWrite = { set: {}, unset: [] };
  if (input.email !== undefined) w.set.email = normalizeEmail(input.email);
  if (input.username !== undefined) w.set.username = normalizeUsername(input.username);
  assign(w, 'name', input.name);
  assign(w, 'avatar', input.avatar);
  assign(w, 'tenantId', input.tenantId);
  assign(w, 'expiresAt', input.expiresAt);
  assign(w, 'password', input.passwordHash);
  if (input.provider !== undefined) w.set.provider = input.provider;
  if (input.role !== undefined) w.set.role = input.role;
  if (input.emailVerified !== undefined) w.set.emailVerified = input.emailVerified;

  if (input.identities !== undefined) {
    for (const provider of IDENTITY_PROVIDERS) {
      w.unset.push(`${provider}Id`);
    }
    w.unset.push('openidIssuer');
    for (const identity of input.identities) {
      if (!IDENTITY_PROVIDERS.some((p) => p === identity.provider)) {
        throw new PortError('ConstraintViolation', 'Unsupported identity provider', {
          field: 'identities',
        });
      }
      w.set[`${identity.provider}Id`] = identity.providerUserId;
      if (identity.provider === 'openid' && identity.issuer) {
        w.set.openidIssuer = identity.issuer;
      }
    }
    w.unset = w.unset.filter((f) => !(f in w.set));
  }

  if (input.preferences !== undefined) {
    for (const key of Object.keys(input.preferences)) {
      if (!PREFERENCE_KEYS.includes(key)) {
        throw new PortError('ConstraintViolation', 'Unsupported preference key', {
          field: 'preferences',
        });
      }
    }
    for (const key of PREFERENCE_KEYS) {
      const value = input.preferences[key];
      if (value === undefined) {
        w.unset.push(key);
      } else {
        w.set[key] = value;
      }
    }
  }
  return w;
}
