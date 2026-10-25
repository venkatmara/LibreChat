import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import mongoose from 'mongoose';

export const DEFAULT_AUDIT_FILE = 'docs/audit/mongo-collections.json';
const MODELS_DIR = 'packages/data-schemas/src/models';
const MODEL_CALL =
  /\.model\s*(?:<[^(]*?>)?\s*\(\s*'([A-Za-z]+)'\s*,\s*[\w.]+\s*(?:,\s*'([\w.]+)')?/g;

export interface AuditEntry {
  collection: string;
  model: string;
  schemaFile: string;
  services: string[];
  slice: string;
}

export interface AuditFile {
  version: 1;
  collections: AuditEntry[];
}

export interface AuditResult {
  ok: boolean;
  missing: string[];
  stale: string[];
  missingServices: { collection: string; path: string }[];
  errors: string[];
}

/** Collection names defined by the Mongoose models, read statically from the data-schemas sources. */
export function discoverCollections(repoRoot: string): string[] {
  const dir = join(repoRoot, MODELS_DIR);
  const pluralize = mongoose.pluralize();
  const names = new Set<string>();
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.ts') || file.endsWith('.spec.ts')) continue;
    const source = readFileSync(join(dir, file), 'utf8');
    for (const match of source.matchAll(MODEL_CALL)) {
      const model = match[1];
      if (model === undefined) continue;
      const explicit = match[2];
      const collection = explicit ?? (pluralize ? pluralize(model) : undefined);
      if (collection) names.add(collection);
    }
  }
  return [...names].sort();
}

function parseAudit(raw: string): AuditFile | string {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return 'audit file is not valid JSON';
  }
  if (typeof data !== 'object' || data === null) return 'audit file must be a JSON object';
  const { version, collections } = data as { version?: unknown; collections?: unknown };
  if (version !== 1) return 'audit file version must be 1';
  if (!Array.isArray(collections)) return 'audit file needs a "collections" array';
  return data as AuditFile;
}

export function checkAudit(
  auditPath: string,
  repoRoot: string,
  collections: readonly string[] = discoverCollections(repoRoot),
): AuditResult {
  const result: AuditResult = {
    ok: false,
    missing: [],
    stale: [],
    missingServices: [],
    errors: [],
  };
  if (!existsSync(auditPath)) {
    result.errors.push(`audit file not found: ${auditPath}`);
    return result;
  }
  const audit = parseAudit(readFileSync(auditPath, 'utf8'));
  if (typeof audit === 'string') {
    result.errors.push(audit);
    return result;
  }
  const listed = new Set<string>();
  for (const entry of audit.collections) {
    listed.add(entry.collection);
    const services = Array.isArray(entry.services) ? entry.services : [];
    if (services.length === 0) {
      result.errors.push(`collection "${entry.collection}" lists no services`);
    }
    for (const path of services) {
      if (!existsSync(join(repoRoot, path))) {
        result.missingServices.push({ collection: entry.collection, path });
      }
    }
  }
  const defined = new Set(collections);
  result.missing = collections.filter((c) => !listed.has(c));
  result.stale = [...listed].filter((c) => !defined.has(c)).sort();
  result.ok =
    result.missing.length === 0 &&
    result.stale.length === 0 &&
    result.missingServices.length === 0 &&
    result.errors.length === 0;
  return result;
}

export function formatAuditResult(result: AuditResult): string {
  if (result.ok) return 'audit-check: OK';
  const lines = ['audit-check: FAILED'];
  for (const c of result.missing) lines.push(`missing collection: ${c}`);
  for (const c of result.stale) lines.push(`stale collection: ${c}`);
  for (const s of result.missingServices) {
    lines.push(`missing service path: ${s.path} (collection ${s.collection})`);
  }
  for (const e of result.errors) lines.push(`error: ${e}`);
  return lines.join('\n');
}

/** Runs `lcmig audit-check [--file <path>] [--root <dir>]`; returns the output and the exit code. */
export function runAuditCheck(
  args: readonly string[],
  cwd: string,
): { exitCode: number; output: string } {
  let root = cwd;
  let file: string | undefined;
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];
    if ((flag !== '--file' && flag !== '--root') || value === undefined) {
      return { exitCode: 2, output: 'Usage: lcmig audit-check [--file <path>] [--root <dir>]' };
    }
    if (flag === '--file') file = value;
    else root = value;
  }
  try {
    const result = checkAudit(file ?? join(root, DEFAULT_AUDIT_FILE), root);
    return { exitCode: result.ok ? 0 : 1, output: formatAuditResult(result) };
  } catch (error) {
    return { exitCode: 2, output: error instanceof Error ? error.message : String(error) };
  }
}
