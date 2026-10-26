import { Types } from 'mongoose';

const HASH = '$2a$10$abcdefghijklmnopqrstuvABCDEFGHIJKLMNOPQRSTUVWXYZ01234';
const at = (n: number) => new Date(Date.UTC(2024, 0, n, 12, 0, 0, 123));

/** Fixture `users` documents: 4 valid (one OAuth) plus 5 rejects, with stable ids. */
export function userFixture(): { docs: Record<string, unknown>[]; valid: number; rejects: number } {
  const id = (n: number) => new Types.ObjectId(n.toString(16).padStart(24, '0'));
  const base = (n: number, extra: Record<string, unknown>) => ({
    _id: id(n),
    provider: 'local',
    role: 'USER',
    emailVerified: false,
    createdAt: at(n),
    updatedAt: at(n + 1),
    ...extra,
  });
  const docs = [
    base(1, { email: 'alice@example.com', username: 'alice', name: 'Alice', password: HASH }),
    base(2, { email: 'Bob@Example.com', username: 'bob', password: HASH, role: 'ADMIN' }),
    base(3, {
      email: 'carol@example.com',
      provider: 'openid',
      openidId: 'sub-3',
      openidIssuer: 'https://issuer.example',
      googleId: 'g-3',
      tenantId: 't1',
    }),
    base(4, { email: 'dave@example.com', username: '', password: HASH, favorites: [{ model: 'm' }] }),
    base(5, { email: 'alice@example.com', username: 'alice2' }),
    base(6, { email: 'erin@example.com', username: 'bob' }),
    base(7, { name: 'No Email' }),
    base(8, { email: 'not-an-email' }),
    base(9, { email: 'frank@example.com', twoFactorEnabled: true, password: HASH }),
  ];
  return { docs, valid: 4, rejects: 5 };
}
