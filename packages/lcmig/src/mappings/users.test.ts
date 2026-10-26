import { Types } from 'mongoose';
import { checksumView, mapUser } from './users';
import type { SourceUserDoc } from './users';

const doc = (extra: Record<string, unknown> = {}): SourceUserDoc =>
  ({
    _id: new Types.ObjectId('000000000000000000000001'),
    email: ' Alice@Example.com ',
    username: 'Alice',
    password: 'hash',
    createdAt: new Date('2024-01-01T00:00:00.123Z'),
    updatedAt: new Date('2024-01-02T00:00:00.000Z'),
    googleId: 'g1',
    openidId: 'o1',
    openidIssuer: 'iss',
    ...extra,
  }) as SourceUserDoc;

function mapped(extra?: Record<string, unknown>) {
  const result = mapUser(doc(extra));
  if (!result.ok) throw new Error(`rejected: ${result.reason}`);
  return result.user;
}

describe('mapUser', () => {
  it('normalises email/username, keeps legacy id and hash, extracts identities', () => {
    const user = mapped();
    expect(user.legacyId).toBe('000000000000000000000001');
    expect(user.record.email).toBe('alice@example.com');
    expect(user.record.username).toBe('alice');
    expect(user.passwordHash).toBe('hash');
    expect(user.record.identities.map((i) => i.provider).sort()).toEqual(['google', 'openid']);
  });

  it.each([
    ['missing_email', { email: undefined }],
    ['missing_email', { email: '  ' }],
    ['malformed_email', { email: 'nope' }],
    ['unsupported_two_factor', { twoFactorEnabled: true }],
    ['invalid_timestamp', { createdAt: undefined }],
  ])('rejects with %s', (reason, extra) => {
    const result = mapUser(doc(extra));
    expect(result).toMatchObject({ ok: false, reason, legacyId: '000000000000000000000001' });
  });

  it('reject results never carry values or hashes', () => {
    const result = mapUser(doc({ twoFactorEnabled: true }));
    expect(JSON.stringify(result)).not.toMatch(/hash|alice/i);
  });
});

describe('checksumView', () => {
  it('is stable for equivalent data regardless of identity order', () => {
    const a = mapped();
    const reordered = {
      ...a.record,
      identities: [...a.record.identities].reverse(),
    };
    expect(checksumView(reordered, a.passwordHash)).toBe(checksumView(a.record, a.passwordHash));
    expect(checksumView(a.record, a.passwordHash)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('changes when any single field changes', () => {
    const a = mapped();
    const base = checksumView(a.record, a.passwordHash);
    expect(checksumView({ ...a.record, role: 'ADMIN' }, a.passwordHash)).not.toBe(base);
    expect(checksumView(a.record, 'other')).not.toBe(base);
    expect(
      checksumView({ ...a.record, updatedAt: new Date(a.record.updatedAt.getTime() + 1) }, a.passwordHash),
    ).not.toBe(base);
  });
});
