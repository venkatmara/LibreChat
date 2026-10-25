import { PortError } from '@lcmig/persistence-core';

interface PgLikeError {
  code?: string;
  constraint?: string;
}

/** Constraint names from migration 0002 mapped to the port's field names. */
const CONSTRAINT_FIELDS: Record<string, string> = {
  users_email_tenant_uq: 'email',
  users_username_uq: 'username',
  users_legacy_id_key: 'legacy_id',
};

const TRANSIENT_CODES = new Set(['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND']);

/**
 * Maps `pg` driver errors to {@link PortError}. Messages are fixed strings: driver messages and
 * `detail` can echo row values (emails, usernames), so they are kept only as `cause`.
 */
export function mapPgError(err: unknown): PortError {
  if (err instanceof PortError) {
    return err;
  }
  const { code, constraint } = (typeof err === 'object' && err !== null ? err : {}) as PgLikeError;
  if (code === '23505') {
    const field = (constraint && CONSTRAINT_FIELDS[constraint]) || 'unknown';
    return new PortError('Conflict', `Unique constraint violated on ${field}`, {
      cause: err,
      field,
    });
  }
  if (code === '23502' || code === '23514' || code === '22P02' || code === '23503') {
    return new PortError('ConstraintViolation', 'Constraint violated', { cause: err });
  }
  if (
    (code && (code.startsWith('08') || code.startsWith('53') || code === '57P01')) ||
    (code && TRANSIENT_CODES.has(code)) ||
    (err instanceof AggregateError && err.errors.some((e: unknown) => isTransient(e)))
  ) {
    return new PortError('Transient', 'Database temporarily unavailable', { cause: err });
  }
  return new PortError('Transient', 'Unexpected database error', { cause: err });
}

function isTransient(err: unknown): boolean {
  const code = (err as PgLikeError | null)?.code;
  return code !== undefined && TRANSIENT_CODES.has(code);
}
