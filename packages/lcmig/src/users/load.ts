import { PortError } from '@lcmig/persistence-core';
import { mapPgError } from '@lcmig/persistence-postgres';
import type { Database } from '@lcmig/persistence-postgres';
import type { Kysely } from 'kysely';
import { USERS_ENTITY } from '../mappings/users';
import type { MappedUser, RejectReason } from '../mappings/users';

export interface LoadStats {
  written: number;
  skipped: number;
  rejected: number;
}

const FIELD_REASONS: Record<string, RejectReason> = {
  email: 'conflict_email',
  username: 'conflict_username',
};

export async function recordReject(
  db: Kysely<Database>,
  runId: string,
  legacyId: string,
  reason: RejectReason,
  fields: string[],
): Promise<void> {
  // Detail holds field names only: never values, hashes or emails.
  await db
    .insertInto('migration_rejects')
    .values({
      entity: USERS_ENTITY,
      legacy_id: legacyId,
      reason,
      run_id: runId,
      detail: JSON.stringify({ fields }),
    })
    .onConflict((oc) => oc.columns(['entity', 'legacy_id']).doNothing())
    .execute();
}

/**
 * Loads one user in its own transaction, idempotent via `legacy_id` (existing rows are skipped).
 * Unique-constraint failures are returned as a reject reason instead of aborting the batch.
 */
export async function loadUser(
  db: Kysely<Database>,
  user: MappedUser,
): Promise<'written' | 'skipped' | { reject: RejectReason; field: string }> {
  const { record } = user;
  try {
    return await db.transaction().execute(async (trx) => {
      const row = await trx
        .insertInto('users')
        .values({
          legacy_id: user.legacyId,
          email: record.email,
          username: record.username,
          name: record.name,
          provider: record.provider,
          role: record.role,
          email_verified: record.emailVerified,
          password_hash: user.passwordHash,
          avatar: record.avatar,
          tenant_id: record.tenantId,
          expires_at: record.expiresAt,
          preferences: JSON.stringify(record.preferences),
          created_at: record.createdAt,
          updated_at: record.updatedAt,
        })
        .onConflict((oc) => oc.column('legacy_id').doNothing())
        .returning('id')
        .executeTakeFirst();
      if (!row) return 'skipped' as const;
      if (record.identities.length) {
        await trx
          .insertInto('user_identities')
          .values(
            record.identities.map((i) => ({
              user_id: row.id,
              provider: i.provider,
              issuer: i.issuer ?? '',
              provider_user_id: i.providerUserId,
            })),
          )
          .onConflict((oc) => oc.doNothing())
          .execute();
      }
      return 'written' as const;
    });
  } catch (err) {
    const mapped = mapPgError(err);
    if (mapped.kind === 'Conflict' || mapped.kind === 'ConstraintViolation') {
      const field = mapped.field ?? 'unknown';
      return { reject: FIELD_REASONS[field] ?? 'conflict_other', field };
    }
    throw mapped instanceof PortError ? mapped : err;
  }
}
