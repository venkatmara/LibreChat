import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { checkAudit, discoverCollections, runAuditCheck, DEFAULT_AUDIT_FILE } from './check';

const repoRoot = resolve(__dirname, '../../../..');
const auditPath = join(repoRoot, DEFAULT_AUDIT_FILE);

function withoutCollection(name: string): string {
  const audit = JSON.parse(readFileSync(auditPath, 'utf8')) as {
    collections: { collection: string }[];
  };
  audit.collections = audit.collections.filter((c) => c.collection !== name);
  const file = join(mkdtempSync(join(tmpdir(), 'audit-')), 'audit.json');
  writeFileSync(file, JSON.stringify(audit));
  return file;
}

describe('audit-check', () => {
  it('TC-1: audit file lists every Mongoose collection with existing services', () => {
    const collections = discoverCollections(repoRoot);
    expect(collections).toContain('users');
    expect(collections).toContain('messages');
    const audit = JSON.parse(readFileSync(auditPath, 'utf8')) as {
      version: number;
      collections: { collection: string; services: string[] }[];
    };
    expect(audit.version).toBe(1);
    for (const name of collections) {
      const entry = audit.collections.find((c) => c.collection === name);
      expect(entry?.services.length ?? 0).toBeGreaterThan(0);
    }
    const result = checkAudit(auditPath, repoRoot);
    expect(result.missingServices).toEqual([]);
  });

  it('TC-2: audit check fails and names a missing collection', () => {
    const { exitCode, output } = runAuditCheck(
      ['--file', withoutCollection('messages'), '--root', repoRoot],
      repoRoot,
    );
    expect(exitCode).toBe(1);
    expect(output).toContain('missing collection: messages');
  });

  it('TC-3: audit check passes on the committed audit file', () => {
    const { exitCode, output } = runAuditCheck([], repoRoot);
    expect(output).toBe('audit-check: OK');
    expect(exitCode).toBe(0);
  });

  it('reports stale entries and missing service paths', () => {
    const result = checkAudit(auditPath, repoRoot, ['users']);
    expect(result.ok).toBe(false);
    expect(result.stale).toContain('messages');
    const file = join(mkdtempSync(join(tmpdir(), 'audit-')), 'audit.json');
    writeFileSync(
      file,
      JSON.stringify({
        version: 1,
        collections: [
          {
            collection: 'users',
            model: 'User',
            schemaFile: 'x',
            services: ['nope.js'],
            slice: 'users',
          },
        ],
      }),
    );
    expect(checkAudit(file, repoRoot, ['users']).missingServices).toEqual([
      { collection: 'users', path: 'nope.js' },
    ]);
  });

  it('exits 2 on bad usage and 1 when the file is missing or invalid', () => {
    expect(runAuditCheck(['--bogus'], repoRoot).exitCode).toBe(2);
    expect(runAuditCheck(['--file', join(tmpdir(), 'no-such-audit.json')], repoRoot).exitCode).toBe(
      1,
    );
    const bad = join(mkdtempSync(join(tmpdir(), 'audit-')), 'audit.json');
    writeFileSync(bad, '{');
    expect(runAuditCheck(['--file', bad], repoRoot).exitCode).toBe(1);
  });
});
