#!/usr/bin/env node
import { run } from './index';

try {
  console.log(run(process.argv.slice(2)));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
