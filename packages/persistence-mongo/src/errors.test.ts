import { PortError } from '@lcmig/persistence-core';
import { mapMongoError } from './errors';

describe('mapMongoError', () => {
  it('maps duplicate key errors to Conflict with the index field', () => {
    const err = mapMongoError({ code: 11000, keyPattern: { email: 1, tenantId: 1 } });
    expect(err).toBeInstanceOf(PortError);
    expect([err.kind, err.field]).toEqual(['Conflict', 'email']);
  });

  it('maps validation and cast errors to ConstraintViolation', () => {
    expect(mapMongoError({ name: 'ValidationError', errors: { email: {} } }).field).toBe('email');
    expect(mapMongoError({ name: 'CastError', path: 'x' }).kind).toBe('ConstraintViolation');
  });

  it('maps network errors to Transient and rethrows unknown errors', () => {
    expect(mapMongoError({ name: 'MongoNetworkError' }).kind).toBe('Transient');
    const boom = new Error('boom');
    expect(() => mapMongoError(boom)).toThrow(boom);
  });
});
