import { createPostgresModule } from './index';

describe('postgres module config', () => {
  it('fails fast without DATABASE_URL', () => {
    expect(() => createPostgresModule({})).toThrow(/DATABASE_URL is required/);
    expect(() => createPostgresModule({ databaseUrl: '  ' })).toThrow(/DATABASE_URL is required/);
  });

  it('never echoes an invalid URL or its password', () => {
    for (const databaseUrl of ['not a url s3cr3t-pw', 'mysql://u:s3cr3t-pw@h/db']) {
      let message = '';
      try {
        createPostgresModule({ databaseUrl });
      } catch (err) {
        message = String(err);
      }
      expect(message).not.toBe('');
      expect(message).not.toContain('s3cr3t-pw');
    }
  });

  it('reports unhealthy (not throwing) when the database is unreachable', async () => {
    const mod = createPostgresModule({ databaseUrl: 'postgres://u:pw@127.0.0.1:1/db' });
    expect(await mod.health()).toEqual({ ok: false, adapter: 'postgres' });
    await mod.close();
  });
});
