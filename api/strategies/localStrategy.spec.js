const bcrypt = require('bcryptjs');

let repo;
jest.mock('~/persistence', () => ({ getUserRepo: () => repo }));
jest.mock('@librechat/data-schemas', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));
jest.mock('@librechat/api', () => ({
  isEnabled: (v) => v === 'true',
  comparePassword: async (user, candidate, deps) => deps.compare(candidate, user.password),
  compareSecret: (candidate, hash) => bcrypt.compare(candidate, hash),
  grandfatherLegacyEmailVerification: async () => false,
}));

const createStrategy = require('./localStrategy');

const hash = bcrypt.hashSync('correct-horse', 4);
const base = {
  email: 'a@example.com',
  username: null,
  name: 'A',
  provider: 'local',
  role: 'USER',
  emailVerified: true,
  tenantId: null,
  avatar: null,
  expiresAt: null,
  identities: [],
  preferences: {},
  createdAt: new Date(0),
  updatedAt: new Date(0),
  passwordHash: hash,
};

/** In-memory repo; only the id format differs between the two "adapters". */
const fakeRepo = (id) => ({
  getAuthByEmail: async (email) => (email === base.email ? { ...base, id } : null),
  update: jest.fn(),
});

const login = (email, password) =>
  new Promise((resolve, reject) => {
    const verify = createStrategy()._verify;
    verify({ body: { email, password }, ip: '1.2.3.4' }, email, password, (err, user, info) =>
      err ? reject(err) : resolve({ user, info }),
    );
  });

const normalise = ({ user, info }) => ({
  ok: Boolean(user),
  info,
  user: user && { ...user, id: '<id>', _id: '<id>' },
});

const adapters = { mongo: '665f1c2e9b1e8a0012345678', postgres: '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b' };

describe('localStrategy login parity across adapters', () => {
  it('TC-28: valid credentials give the same result modulo ids', async () => {
    const results = {};
    for (const [name, id] of Object.entries(adapters)) {
      repo = fakeRepo(id);
      const r = await login(base.email, 'correct-horse');
      expect(r.user._id).toBe(id);
      expect(r.user.password).toBe(hash);
      results[name] = normalise(r);
    }
    expect(results.postgres).toEqual(results.mongo);
    expect(results.mongo.ok).toBe(true);
  });

  it('TC-29: wrong password and unknown email fail identically', async () => {
    for (const [email, password, message] of [
      [base.email, 'nope-nope', 'Incorrect password.'],
      ['missing@example.com', 'correct-horse', 'Email does not exist.'],
    ]) {
      const results = [];
      for (const id of Object.values(adapters)) {
        repo = fakeRepo(id);
        results.push(normalise(await login(email, password)));
      }
      expect(results[1]).toEqual(results[0]);
      expect(results[0]).toEqual({ ok: false, info: { message }, user: false });
    }
  });
});
