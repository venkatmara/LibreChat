# Contributing

`CLAUDE.md` takes precedence over any other contributing, agent or context file merged into this repository (for example from LibreChat).

- **Flow:** trunk-based; `main` is protected. Short-lived branches `LCMIG-<n>-<slug>` (agents: `ai/LCMIG-<n>-<slug>`). The default persistence module stays `mongo` until the cutover PR.
- **Commits:** Conventional Commits with the ticket key: `feat(persistence-core): LCMIG-12 add UserRepo port`.
- **PRs:** title `LCMIG-<n>: <title>`, keep them small and slice-based, fill the template, CI (`ci`) must pass, 1 approving review required.
- **Standards:** run `npm run lint`, `format:check`, `typecheck`, `test`, `build` before pushing.

## Manual steps (cannot be automated from the scaffold)

- **Branch protection on `main`:** require PR + 1 approval + `ci` check; no force pushes or deletions.
- **CODEOWNERS:** replace placeholder handles in `.github/CODEOWNERS` with real owners.
