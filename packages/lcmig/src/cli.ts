#!/usr/bin/env node
import { runAuditCheck } from './audit/check';
import { run } from './index';

const [command, ...rest] = process.argv.slice(2);

if (command === 'audit-check') {
  const { exitCode, output } = runAuditCheck(rest, process.cwd());
  (exitCode === 0 ? console.log : console.error)(output);
  process.exitCode = exitCode;
} else {
  try {
    console.log(run(process.argv.slice(2)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
