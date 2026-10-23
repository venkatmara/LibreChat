# Contributing

- **Flow:** trunk-based; `main` is protected (PR required, 1 approving review, CI required, no force pushes).
- **Branches:** `ai/LCMIG-<n>-<slug>` (agents) or `feat/LCMIG-<n>-<slug>` (humans). Keep them short-lived.
- **Commits:** Conventional Commits with the key: `feat(persistence-core): LCMIG-12 add UserRepo port`.
- **PRs:** title `LCMIG-<n>: <title>`; use the PR template; keep them small (one slice or concern, ideally < 400 changed lines).
- **Rules:** no `mongoose`/`mongodb` imports outside `persistence-mongo` (lint-enforced); schema migrations are forward-only and reviewed by the architect; default module stays `mongo` until the cutover PR.
