#!/usr/bin/env node
import { runAuditCheck } from './audit/check';
import { run } from './index';
import { runUsersCommand } from './users/command';

const [command, ...rest] = process.argv.slice(2);

async function main(): Promise<void> {
  if (command === 'audit-check') {
    const { exitCode, output } = runAuditCheck(rest, process.cwd());
    (exitCode === 0 ? console.log : console.error)(output);
    process.exitCode = exitCode;
  } else if (command === 'users' || command === 'reconcile') {
    const { exitCode, output } = await runUsersCommand(process.argv.slice(2), process.env);
    (exitCode === 2 ? console.error : console.log)(output);
    process.exitCode = exitCode;
  } else {
    try {
      console.log(run(process.argv.slice(2)));
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  }
}

void main();
