export const STAGES = ['profile', 'extract', 'transform', 'load', 'reconcile', 'report'] as const;
export type Stage = (typeof STAGES)[number];

export function parseStage(arg: string | undefined): Stage {
  if (arg && (STAGES as readonly string[]).includes(arg)) {
    return arg as Stage;
  }
  throw new Error(
    `Usage: lcmig <${STAGES.join('|')}> [--dry-run] [--resume] [--entity=...] [--delta]`,
  );
}

export function run(argv: string[]): string {
  const stage = parseStage(argv[0]);
  return `lcmig: stage "${stage}" is not implemented yet`;
}
