## What changed

-

## Why

Jira: LCMIG-<n> (link). Acceptance criteria addressed:
-

## How it was tested

- [ ] `npm run lint` / `npm run format:check` / `npm run typecheck` / `npm test` / `npm run build`

## Risk and rollback

-

## Checklist

- [ ] Branch named `LCMIG-<n>-…` and commits use Conventional Commits with the ticket key
- [ ] No imports of `mongoose`/`mongodb` outside `persistence-mongo` and `lcmig`
- [ ] No secrets; `.env.example` updated if config changed
- [ ] Docs / ADR updated where behaviour or decisions changed
