import { run } from './cli';

export * from './cli';

if (require.main === module) {
  try {
    process.stdout.write(`${run(process.argv.slice(2))}\n`);
  } catch (err) {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    process.exitCode = 1;
  }
}
