import type { ReconcileResult } from './reconcile';

export interface UsersReport {
  runId: string;
  command: 'users' | 'reconcile';
  dryRun: boolean;
  read: number;
  written: number;
  skipped: number;
  rejected: number;
  reconcile: ReconcileResult | null;
}

/** JSON plus a short text summary. Contains counts and `legacy_id`s only. */
export function formatReport(report: UsersReport): string {
  const r = report.reconcile;
  const lines = [
    JSON.stringify(report, null, 2),
    `run ${report.runId}: read=${report.read} written=${report.written} skipped=${report.skipped} rejected=${report.rejected}${report.dryRun ? ' (dry run)' : ''}`,
  ];
  if (r) {
    lines.push(
      `reconcile: mongo=${r.mongoCount} rejects=${r.rejectCount} expected=${r.expectedCount} postgres=${r.pgCount} checksumMismatches=${r.checksumMismatches.length} -> ${r.ok ? 'OK' : 'MISMATCH'}`,
    );
  }
  return lines.join('\n');
}
