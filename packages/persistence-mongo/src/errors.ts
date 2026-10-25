import { PortError } from '@lcmig/persistence-core';

interface MongoLikeError {
  name?: string;
  code?: number;
  keyPattern?: Record<string, unknown>;
  keyValue?: Record<string, unknown>;
  errors?: Record<string, unknown>;
  path?: string;
}

const TRANSIENT_NAMES = new Set([
  'MongoNetworkError',
  'MongoNetworkTimeoutError',
  'MongoServerSelectionError',
  'MongoNotConnectedError',
  'MongoTopologyClosedError',
]);

/** Duplicate-key index fields map onto the port's field names. */
function conflictField(err: MongoLikeError): string {
  const keys = Object.keys(err.keyPattern ?? err.keyValue ?? {}).filter((k) => k !== 'tenantId');
  return keys[0] ?? 'unknown';
}

/** Maps Mongo / Mongoose driver errors to {@link PortError}; never copies values into messages. */
export function mapMongoError(err: unknown): PortError {
  if (err instanceof PortError) {
    return err;
  }
  const e = (typeof err === 'object' && err !== null ? err : {}) as MongoLikeError;
  if (e.code === 11000) {
    const field = conflictField(e);
    return new PortError('Conflict', `Unique constraint violated on ${field}`, {
      cause: err,
      field,
    });
  }
  if (e.name === 'ValidationError') {
    const field = Object.keys(e.errors ?? {})[0];
    return new PortError('ConstraintViolation', `Validation failed${field ? ` on ${field}` : ''}`, {
      cause: err,
      field,
    });
  }
  if (e.name === 'CastError') {
    return new PortError('ConstraintViolation', `Invalid value for ${e.path ?? 'field'}`, {
      cause: err,
      field: e.path,
    });
  }
  if (e.name && TRANSIENT_NAMES.has(e.name)) {
    return new PortError('Transient', 'Mongo is temporarily unavailable', { cause: err });
  }
  throw err;
}
