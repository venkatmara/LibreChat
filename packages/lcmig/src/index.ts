export const STAGES = ['profile', 'extract', 'transform', 'load', 'reconcile', 'report'] as const;
export type Stage = (typeof STAGES)[number];

export function run(argv: readonly string[]): string {
  const [command] = argv;
  if (command === undefined || command === '--help') {
    return `Usage: lcmig <${STAGES.join('|')}|audit-check|users>`;
  }
  const stage = STAGES.find((s) => s === command);
  if (!stage) {
    throw new Error(`Unknown command "${command}"`);
  }
  return `${stage}: not implemented yet`;
}
