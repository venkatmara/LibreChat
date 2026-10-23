## What changed

-

## Why

Jira: LCMIG-<n> (link). Acceptance criteria addressed:
-

## How it was tested

- [ ] `npm run lint` / `npm run typecheck` / `npm test`

## Risk and rollback

Impact, migration notes, how to revert:

## Checklist

- [ ] No `mongoose`/`mongodb` imports outside `persistence-mongo`
- [ ] Tests added/updated; contract tests pass for affected ports
- [ ] No secrets committed; docs/ADR updated if needed
