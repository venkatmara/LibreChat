import { toUserAuthRecord } from '@lcmig/persistence-postgres';
import type { Database } from '@lcmig/persistence-postgres';
import type { Kysely } from 'kysely';
import type { UsersCollection } from './types';
import { USERS_ENTITY, checksumView, mapUser } from '../mappings/users';
import { extractUsers } from './extract';

export interface ReconcileResult {
  mongoCount: number;
  pgCount: number;
  rejectCount: number;
  expectedCount: number;
  checksumMismatches: string[];
  missingInPostgres: string[];
  extraInPostgres: number;
  ok: boolean;
}

/**
 * Compares counts (Mongo - rejects = Postgres, A-4) and per-row checksums, joined by `legacy_id`.
 * Mismatches are reported by `legacy_id` only.
 */
export async function reconcileUsers(
  collection: UsersCollection,
  db: Kysely<Database>,
  batchSize: number,
): Promise<ReconcileResult> {
  const mongoCount = await collection.countDocuments({});
  const pg = await db
    .selectFrom('users')
    .select((eb) => eb.fn.countAll<string>().as('n'))
    .executeTakeFirstOrThrow();
  const rejects = await db
    .selectFrom('migration_rejects')
    .select((eb) => eb.fn.countAll<string>().as('n'))
    .where('entity', '=', USERS_ENTITY)
    .executeTakeFirstOrThrow();
  const pgCount = Number(pg.n);
  const rejectCount = Number(rejects.n);

  const checksumMismatches: string[] = [];
  const missingInPostgres: string[] = [];
  let matched = 0;

  for await (const batch of extractUsers(collection, batchSize)) {
    const mapped = batch.map(mapUser);
    const ids = batch.map((d) => d._id.toString());
    const rows = await db.selectFrom('users').selectAll().where('legacy_id', 'in', ids).execute();
    const userIds = rows.map((r) => r.id);
    const identities = userIds.length
      ? await db.selectFrom('user_identities').selectAll().where('user_id', 'in', userIds).execute()
      : [];
    const byLegacy = new Map(rows.map((r) => [r.legacy_id, r]));
    const rejected = new Set(
      (
        await db
          .selectFrom('migration_rejects')
          .select('legacy_id')
          .where('entity', '=', USERS_ENTITY)
          .where('legacy_id', 'in', ids)
          .execute()
      ).map((r) => r.legacy_id),
    );
    for (const m of mapped) {
      const legacyId = m.ok ? m.user.legacyId : m.legacyId;
      const row = byLegacy.get(legacyId);
      if (!row) {
        if (!rejected.has(legacyId)) missingInPostgres.push(legacyId);
        continue;
      }
      if (!m.ok) {
        // Rejected at the source mapping but present in Postgres: not expected.
        checksumMismatches.push(legacyId);
        continue;
      }
      matched += 1;
      const auth = toUserAuthRecord(
        row,
        identities.filter((i) => i.user_id === row.id),
      );
      if (
        checksumView(auth, auth.passwordHash) !== checksumView(m.user.record, m.user.passwordHash)
      ) {
        checksumMismatches.push(legacyId);
      }
    }
  }

  const expectedCount = mongoCount - rejectCount;
  const extraInPostgres = Math.max(0, pgCount - matched);
  return {
    mongoCount,
    pgCount,
    rejectCount,
    expectedCount,
    checksumMismatches,
    missingInPostgres,
    extraInPostgres,
    ok:
      pgCount === expectedCount &&
      checksumMismatches.length === 0 &&
      missingInPostgres.length === 0 &&
      extraInPostgres === 0,
  };
}
