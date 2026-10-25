import assert from 'node:assert/strict';
import { PortError } from '../errors';
import type { PortErrorKind } from '../errors';
import type { UserRepo } from '../ports';

/** Minimal test-runner surface (jest-compatible) so the kit does not depend on a runner's types. */
export interface ContractHarness {
  describe(name: string, fn: () => void): void;
  it(name: string, fn: () => Promise<void>): void;
  beforeEach(fn: () => Promise<void>): void;
  afterAll(fn: () => Promise<void>): void;
}

export interface ContractContext {
  users: UserRepo;
  /** Removes every user so each case starts empty. */
  reset(): Promise<void>;
  teardown(): Promise<void>;
}

async function expectPortError(
  promise: Promise<unknown>,
  kind: PortErrorKind,
  field?: string,
): Promise<void> {
  try {
    await promise;
  } catch (err) {
    assert.ok(err instanceof PortError, `expected PortError, got ${String(err)}`);
    assert.equal(err.kind, kind);
    if (field) {
      assert.equal(err.field, field);
    }
    return;
  }
  assert.fail(`expected PortError ${kind}`);
}

/** Runs the shared UserRepo contract against one adapter (ADR-006). */
export function runUserRepoContract(
  adapterName: string,
  factory: () => Promise<ContractContext>,
  harness: ContractHarness = globalThis as unknown as ContractHarness,
): void {
  const { describe, it, beforeEach, afterAll } = harness;

  describe(`UserRepo contract (${adapterName})`, () => {
    let ctx: ContractContext;
    let users: UserRepo;
    let ready: Promise<void> | undefined;
    const init = () => {
      ready ??= factory().then((c) => {
        ctx = c;
        users = c.users;
      });
      return ready;
    };

    beforeEach(async () => {
      await init();
      await ctx.reset();
    });
    afterAll(async () => {
      await init();
      await ctx.teardown();
    });

    it('round-trips create, findById and findByEmail with string ids', async () => {
      const created = await users.create({ email: 'a@example.com', name: 'A' });
      assert.equal(typeof created.id, 'string');
      assert.ok(!('_id' in created));
      assert.equal(created.provider, 'local');
      assert.equal(created.role, 'USER');
      assert.equal(created.emailVerified, false);
      assert.deepEqual(created.identities, []);
      const byId = await users.findById(created.id);
      assert.deepEqual(byId, created);
      assert.deepEqual(await users.findByEmail('a@example.com'), created);
      assert.ok(created.createdAt instanceof Date);
    });

    it('treats email case-insensitively and trims it', async () => {
      const created = await users.create({ email: ' A@Example.com ' });
      assert.equal(created.email, 'a@example.com');
      assert.equal((await users.findByEmail('A@EXAMPLE.COM '))?.id, created.id);
    });

    it('scopes email lookups by tenant', async () => {
      const t1 = await users.create({ email: 't@example.com', tenantId: 'one' });
      const none = await users.create({ email: 't@example.com' });
      assert.notEqual(t1.id, none.id);
      assert.equal((await users.findByEmail('t@example.com', 'one'))?.id, t1.id);
      assert.equal((await users.findByEmail('t@example.com'))?.id, none.id);
      assert.equal(await users.findByEmail('t@example.com', 'two'), null);
    });

    it('stores identities and preferences', async () => {
      const created = await users.create({
        email: 'o@example.com',
        provider: 'google',
        identities: [{ provider: 'google', issuer: null, providerUserId: 'g-1' }],
        preferences: { favorites: ['x'] },
      });
      assert.deepEqual(created.identities, [
        { provider: 'google', issuer: null, providerUserId: 'g-1' },
      ]);
      assert.deepEqual(created.preferences, { favorites: ['x'] });
      assert.deepEqual((await users.findById(created.id))?.identities, created.identities);
    });

    it('updates a user and counts users', async () => {
      assert.equal(await users.count(), 0);
      const created = await users.create({ email: 'u@example.com' });
      const updated = await users.update(created.id, { name: 'New', role: 'ADMIN' });
      assert.equal(updated.id, created.id);
      assert.equal(updated.name, 'New');
      assert.equal(updated.role, 'ADMIN');
      assert.equal(updated.email, 'u@example.com');
      assert.equal(await users.count(), 1);
    });

    it('returns the password hash only from getAuthByEmail', async () => {
      const created = await users.create({ email: 'h@example.com', passwordHash: 'hash-1' });
      assert.ok(!('passwordHash' in created));
      assert.ok(!('passwordHash' in ((await users.findById(created.id)) ?? {})));
      assert.ok(!('passwordHash' in ((await users.findByEmail('h@example.com')) ?? {})));
      assert.ok(!JSON.stringify(created).includes('hash-1'));
      const auth = await users.getAuthByEmail('H@example.com');
      assert.equal(auth?.passwordHash, 'hash-1');
      assert.equal(auth?.id, created.id);
    });

    it('raises Conflict(field=email) on duplicate email, including case and whitespace', async () => {
      await users.create({ email: 'a@example.com' });
      await expectPortError(users.create({ email: 'a@example.com' }), 'Conflict', 'email');
      await expectPortError(users.create({ email: ' A@Example.com ' }), 'Conflict', 'email');
      const other = await users.create({ email: 'b@example.com' });
      await expectPortError(
        users.update(other.id, { email: 'a@example.com' }),
        'Conflict',
        'email',
      );
    });

    it('raises Conflict(field=username) on duplicate username for create and update', async () => {
      await users.create({ email: 'b1@example.com', username: 'bob' });
      await expectPortError(
        users.create({ email: 'b2@example.com', username: 'bob' }),
        'Conflict',
        'username',
      );
      const third = await users.create({ email: 'b3@example.com' });
      await expectPortError(users.update(third.id, { username: 'bob' }), 'Conflict', 'username');
    });

    it('returns null for lookups of non-existent users, including malformed ids', async () => {
      assert.equal(await users.findById('0123456789abcdef01234567'), null);
      assert.equal(await users.findById('018f0000-0000-7000-8000-000000000000'), null);
      assert.equal(await users.findById('not-an-id'), null);
      assert.equal(await users.findByEmail('nobody@example.com'), null);
      assert.equal(await users.getAuthByEmail('nobody@example.com'), null);
    });

    it('raises NotFound when updating a non-existent user', async () => {
      await expectPortError(users.update('0123456789abcdef01234567', { name: 'x' }), 'NotFound');
      await expectPortError(users.update('not-an-id', { name: 'x' }), 'NotFound');
    });

    it('raises ConstraintViolation when email is missing', async () => {
      await expectPortError(users.create({ email: '' }), 'ConstraintViolation');
      await expectPortError(users.create({ email: '   ' }), 'ConstraintViolation');
      await expectPortError(
        users.create({} as unknown as Parameters<UserRepo['create']>[0]),
        'ConstraintViolation',
      );
    });
  });
}
