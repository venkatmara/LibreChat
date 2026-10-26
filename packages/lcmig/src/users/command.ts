import { randomUUID } from 'node:crypto';
import { createDb } from '@lcmig/persistence-postgres';
import mongoose from 'mongoose';
import { USERS_ENTITY, mapUser } from '../mappings/users';
import { extractUsers } from './extract';
import { loadUser, recordReject } from './load';
import { reconcileUsers } from './reconcile';
import { formatReport } from './report';
import type { UsersReport } from './report';

export interface CommandResult {
  exitCode: 0 | 1 | 2;
  output: string;
}

const USAGE =
  'Usage: lcmig users [--batch-size N] [--dry-run] | lcmig reconcile --entity users [--batch-size N]';

interface Options {
  command: 'users' | 'reconcile';
  batchSize: number;
  dryRun: boolean;
}

function parseArgs(argv: readonly string[]): Options | string {
  const [command, ...rest] = argv;
  if (command !== 'users' && command !== 'reconcile') return USAGE;
  let batchSize = 500;
  let dryRun = false;
  let entity: string | undefined;
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (arg === '--dry-run' && command === 'users') dryRun = true;
    else if (arg === '--batch-size') {
      batchSize = Number(rest[(i += 1)]);
      if (!Number.isInteger(batchSize) || batchSize < 1) return USAGE;
    } else if (arg === '--entity' && command === 'reconcile') entity = rest[(i += 1)];
    else return USAGE;
  }
  if (command === 'reconcile' && entity !== USERS_ENTITY) return USAGE;
  return { command, batchSize, dryRun };
}

/** Exit codes: 0 clean, 1 reconcile mismatch, 2 usage or runtime error. Never prints connection strings. */
export async function runUsersCommand(
  argv: readonly string[],
  env: NodeJS.ProcessEnv,
): Promise<CommandResult> {
  const options = parseArgs(argv);
  if (typeof options === 'string') return { exitCode: 2, output: options };
  const mongoUri = env.MONGO_URI;
  if (!mongoUri) return { exitCode: 2, output: 'MONGO_URI is required' };

  let connection: mongoose.Connection | undefined;
  let db: ReturnType<typeof createDb> | undefined;
  try {
    db = createDb({ databaseUrl: env.DATABASE_URL });
    connection = await mongoose.createConnection(mongoUri).asPromise();
    const collection = connection.collection(USERS_ENTITY);
    const report: UsersReport = {
      runId: randomUUID(),
      command: options.command,
      dryRun: options.dryRun,
      read: 0,
      written: 0,
      skipped: 0,
      rejected: 0,
      reconcile: null,
    };
    if (options.command === 'users') {
      for await (const batch of extractUsers(collection, options.batchSize)) {
        for (const doc of batch) {
          report.read += 1;
          const mapped = mapUser(doc);
          if (!mapped.ok) {
            report.rejected += 1;
            if (!options.dryRun) {
              await recordReject(db, report.runId, mapped.legacyId, mapped.reason, mapped.fields);
            }
            continue;
          }
          if (options.dryRun) continue;
          const outcome = await loadUser(db, mapped.user);
          if (outcome === 'written') report.written += 1;
          else if (outcome === 'skipped') report.skipped += 1;
          else {
            report.rejected += 1;
            await recordReject(db, report.runId, mapped.user.legacyId, outcome.reject, [
              outcome.field,
            ]);
          }
        }
      }
    }
    if (!options.dryRun) {
      report.reconcile = await reconcileUsers(collection, db, options.batchSize);
    }
    const ok = report.reconcile?.ok ?? true;
    return { exitCode: ok ? 0 : 1, output: formatReport(report) };
  } catch (err) {
    // Driver messages can embed connection strings, so only the error name is printed.
    const name = err instanceof Error ? err.name : 'Error';
    const message =
      err instanceof Error && err.message.startsWith('DATABASE_URL') ? err.message : '';
    return { exitCode: 2, output: `lcmig failed: ${name}${message ? ` (${message})` : ''}` };
  } finally {
    await db?.destroy();
    await connection?.close();
  }
}
