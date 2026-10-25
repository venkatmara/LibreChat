import { PortError } from '@lcmig/persistence-core';
import type {
  NewUser,
  UserAuthRecord,
  UserPatch,
  UserRecord,
  UserRepo,
} from '@lcmig/persistence-core';
import type { Kysely, Transaction, Updateable } from 'kysely';
import type { Database, UsersTable } from './db';
import { mapPgError } from './errors';
import {
  isUuid,
  normalizeEmail,
  normalizeUsername,
  toUserAuthRecord,
  toUserRecord,
} from './user-mapper';
import type { UserRow } from './user-mapper';

type Executor = Kysely<Database> | Transaction<Database>;

/** `UserRepo` over Postgres (Kysely). Unique violations map to `Conflict` with the offending field. */
export class PostgresUserRepo implements UserRepo {
  constructor(private readonly db: Kysely<Database>) {}

  async findById(id: string): Promise<UserRecord | null> {
    if (!isUuid(id)) return null;
    return this.run(async () => {
      const row = await this.db
        .selectFrom('users')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst();
      return row ? this.hydrate(this.db, row) : null;
    });
  }

  async findByEmail(email: string, tenantId?: string | null): Promise<UserRecord | null> {
    const row = await this.findRowByEmail(email, tenantId);
    return row ? this.run(() => this.hydrate(this.db, row)) : null;
  }

  async getAuthByEmail(email: string, tenantId?: string | null): Promise<UserAuthRecord | null> {
    const row = await this.findRowByEmail(email, tenantId);
    if (!row) return null;
    return this.run(async () => {
      const identities = await this.db
        .selectFrom('user_identities')
        .selectAll()
        .where('user_id', '=', row.id)
        .execute();
      return toUserAuthRecord(row, identities);
    });
  }

  async create(input: NewUser): Promise<UserRecord> {
    const email = normalizeEmail(input?.email);
    if (!email) {
      throw new PortError('ConstraintViolation', 'Email is required', { field: 'email' });
    }
    return this.run(() =>
      this.db.transaction().execute(async (trx) => {
        const row = await trx
          .insertInto('users')
          .values({
            email,
            username: normalizeUsername(input.username),
            name: input.name ?? null,
            provider: input.provider,
            role: input.role,
            email_verified: input.emailVerified,
            password_hash: input.passwordHash ?? null,
            avatar: input.avatar ?? null,
            tenant_id: input.tenantId ?? null,
            expires_at: input.expiresAt ?? null,
            preferences: JSON.stringify(input.preferences ?? {}),
          })
          .returningAll()
          .executeTakeFirstOrThrow();
        await this.insertIdentities(trx, row.id, input.identities);
        return this.hydrate(trx, row);
      }),
    );
  }

  async update(id: string, patch: UserPatch): Promise<UserRecord> {
    if (!isUuid(id)) throw new PortError('NotFound', 'User not found');
    if (patch.email !== undefined && !normalizeEmail(patch.email)) {
      throw new PortError('ConstraintViolation', 'Email is required', { field: 'email' });
    }
    return this.run(() =>
      this.db.transaction().execute(async (trx) => {
        const values = toUpdate(patch);
        const query = trx.updateTable('users').where('id', '=', id);
        const row = await (Object.keys(values).length
          ? query.set(values).returningAll().executeTakeFirst()
          : trx.selectFrom('users').selectAll().where('id', '=', id).executeTakeFirst());
        if (!row) throw new PortError('NotFound', 'User not found');
        if (patch.identities) {
          await trx.deleteFrom('user_identities').where('user_id', '=', id).execute();
          await this.insertIdentities(trx, id, patch.identities);
        }
        return this.hydrate(trx, row);
      }),
    );
  }

  async count(): Promise<number> {
    return this.run(async () => {
      const row = await this.db
        .selectFrom('users')
        .select((eb) => eb.fn.countAll<string>().as('n'))
        .executeTakeFirstOrThrow();
      return Number(row.n);
    });
  }

  private async findRowByEmail(
    email: string,
    tenantId?: string | null,
  ): Promise<UserRow | undefined> {
    return this.run(() =>
      this.db
        .selectFrom('users')
        .selectAll()
        .where('email', '=', normalizeEmail(email))
        .where('tenant_key', '=', tenantId ?? '')
        .executeTakeFirst(),
    );
  }

  private async hydrate(exec: Executor, row: UserRow): Promise<UserRecord> {
    const identities = await exec
      .selectFrom('user_identities')
      .selectAll()
      .where('user_id', '=', row.id)
      .execute();
    return toUserRecord(row, identities);
  }

  private async insertIdentities(
    exec: Executor,
    userId: string,
    identities: NewUser['identities'],
  ): Promise<void> {
    if (!identities?.length) return;
    await exec
      .insertInto('user_identities')
      .values(
        identities.map((i) => ({
          user_id: userId,
          provider: i.provider,
          issuer: i.issuer ?? '',
          provider_user_id: i.providerUserId,
        })),
      )
      .onConflict((oc) => oc.doNothing())
      .execute();
  }

  private async run<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      throw mapPgError(err);
    }
  }
}

function toUpdate(patch: UserPatch): Updateable<UsersTable> {
  const values: Updateable<UsersTable> = {};
  if (patch.email !== undefined) values.email = normalizeEmail(patch.email);
  if (patch.username !== undefined) values.username = normalizeUsername(patch.username);
  if (patch.name !== undefined) values.name = patch.name;
  if (patch.provider !== undefined) values.provider = patch.provider;
  if (patch.role !== undefined) values.role = patch.role;
  if (patch.emailVerified !== undefined) values.email_verified = patch.emailVerified;
  if (patch.passwordHash !== undefined) values.password_hash = patch.passwordHash;
  if (patch.avatar !== undefined) values.avatar = patch.avatar;
  if (patch.tenantId !== undefined) values.tenant_id = patch.tenantId;
  if (patch.expiresAt !== undefined) values.expires_at = patch.expiresAt;
  if (patch.preferences !== undefined) values.preferences = JSON.stringify(patch.preferences);
  // Always bump when anything changed; a no-op patch leaves updated_at alone.
  if (Object.keys(values).length) values.updated_at = new Date();
  return values;
}
