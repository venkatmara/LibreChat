# LibreChat Database Migration (LCMIG) - Project charter and scope

## Vision

Move LibreChat's persistent data layer from MongoDB to PostgreSQL. The move must go through a module-based persistence architecture. Application services depend on database-agnostic interfaces, and database-specific code lives in replaceable modules. The migration compatibility check is reported as already done, so this project builds and delivers the migration. It does not re-assess feasibility.

## Problem

- **Who:** The LibreChat platform and engineering teams, the operators and DBAs who run it, and the enterprise users who depend on it.
- **How it shows up:**
  - MongoDB stores conversations, users, configurations and operational metadata. Its flexible schema was useful early on, but it now limits scalability, maintainability, data consistency and enterprise-grade operations.
  - Application services are coupled to the current persistence layer. A direct database swap would only move that coupling to a new database.
- **Cost:** Higher long-term maintenance effort, weaker data-integrity guarantees, and operational tooling that is harder to standardise. Future growth is also at risk.

The problem statement does not give measured pain points. Baselines in the KPI table are therefore marked TBD until the BA supplies them.

## Goals and KPIs

| Goal                                                     | KPI                                                                                                                                | Baseline                          | Target                                                         | Measured by                                  |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | -------------------------------------------------------------- | -------------------------------------------- |
| G1. Decouple services from the database                  | Share of application services that access data only through the persistence abstraction (no direct Mongo driver or Mongoose usage) | TBD (audit in Architecture phase) | 100% of in-scope services                                      | Static check or lint rule in CI; code review |
| G2. Migrate all in-scope data to PostgreSQL without loss | Record-count and checksum parity per entity between MongoDB and PostgreSQL                                                         | 0% migrated                       | 100% parity; 0 unresolved discrepancies at cutover             | Automated reconciliation report              |
| G3. Functional parity                                    | Existing regression and acceptance tests passing on the PostgreSQL module                                                          | TBD (current MongoDB pass rate)   | 100% of existing tests pass; no P1/P2 defects open at go-live  | CI test run; UAT sign-off                    |
| G4. Acceptable performance and reliability               | p95 latency of key operations (load conversation, list conversations, save message, login)                                         | TBD (measured on MongoDB)         | No worse than baseline +10% (to be confirmed)                  | Load test on a production-like dataset       |
| G5. Safe cutover                                         | Downtime and rollback readiness                                                                                                    | n/a                               | Downtime within agreed window (TBD); tested rollback procedure | Cutover rehearsal in staging                 |

## Stakeholders and users

| Stakeholder / persona                 | Primary need                                                                                             | Involvement                                        |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| BA / Product owner                    | Business continuity and the agreed scope delivered                                                       | Approves scope, requirements and UAT               |
| Architect                             | A clean, extensible persistence abstraction and data model                                               | Approves architecture and plan; consulted on scope |
| Developers (LibreChat maintainers)    | Maintainable code and a clear pattern for adding or swapping database modules                            | Implementation and code review                     |
| Testers / QA                          | Verifiable parity between MongoDB and PostgreSQL behaviour                                               | Test cases and verification                        |
| DevOps / DBA / platform operators     | Standard PostgreSQL operations: backup, monitoring, HA, upgrades. A safe migration and rollback runbook. | Cutover, environments, runbooks                    |
| End users (chat users)                | No visible change and no loss of conversations or settings                                               | UAT; communication about downtime                  |
| Administrators / enterprise customers | Data consistency, auditability, enterprise support                                                       | Consulted; UAT                                     |
| Security / compliance (assumed)       | Protection of migrated data in transit and at rest                                                       | Consulted                                          |

## Scope

- **In scope (MVP):**
  - A persistence abstraction layer, with repository or data-access interfaces and a module-based design. Application services no longer depend on MongoDB directly.
  - A PostgreSQL persistence module that implements those interfaces for all entities currently held in MongoDB: users, conversations and messages, configurations, and operational metadata. The final entity list is confirmed in Architecture.
  - A relational schema design for those entities, with versioned migrations.
  - A data migration tool: extract from MongoDB, transform, load into PostgreSQL. It must be repeatable and idempotent, and it must reconcile and validate the result.
  - Refactoring of the application services to use the abstraction.
  - Configuration-based selection of the persistence module.
  - Automated tests for module parity, migration correctness and regression.
  - A staging cutover rehearsal, a production cutover plan and a rollback plan.
  - Documentation: the module-authoring guide, a migration runbook and operator notes.
- **Later:**
  - Removing the MongoDB module once PostgreSQL is stable.
  - A dual-write or live-sync strategy for zero-downtime migration, if the BA requires it.
  - PostgreSQL-specific optimisations such as partitioning, full-text search and read replicas.
  - Additional database modules built on the new abstraction.
  - Self-service migration tooling for third-party LibreChat deployments.
- **Out of scope:**
  - New end-user features or UI changes.
  - Re-running the migration compatibility assessment, which is already done.
  - Changing non-database stores, unless the BA says otherwise. Examples are file and object storage and any search index or cache. See the open questions.
  - Hosting, cloud infrastructure provisioning and PostgreSQL licensing or procurement.
  - Upstream LibreChat contribution, unless the BA requests it.

## Constraints and assumptions

- **Assumption:** The compatibility check is complete and valid. Its findings will be shared with the Architect as input.
- **Assumption:** The target is a supported, current PostgreSQL version. The exact version and managed or self-hosted choice are TBD.
- **Assumption:** The migration is a one-time move per deployment, with a defined downtime window. Zero-downtime is not an MVP requirement unless the BA says otherwise.
- **Constraint:** The migration must use the module-based architecture. A direct database replacement is explicitly not acceptable.
- **Constraint:** There must be no data loss or corruption. Each deployment's data must be reconciled before cutover is declared complete.
- **Constraint:** Compliance, data residency and retention requirements apply, as they do today. Details are TBD.
- **Constraint:** Budget, dates and team size have not been provided. They are TBD.
- **Constraint:** Target-repository rules (CLAUDE.md, CONTRIBUTING and similar) take precedence over AIDLC defaults.
- **Assumption:** A production-like data volume is available for testing, anonymised where needed.

## Risks

| Risk                                                                                                                     | Likelihood | Impact | Mitigation                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------ | ---------- | ------ | ---------------------------------------------------------------------------------------------------------------- |
| Schema-less Mongo documents (inconsistent fields, nested or variable structures) do not map cleanly to relational tables | High       | High   | Data profiling early; explicit mapping spec; JSONB for genuinely dynamic fields; log and report rejected records |
| Data loss or corruption during migration                                                                                 | Medium     | High   | Reconciliation (counts and checksums); dry runs; backups; rollback plan                                          |
| Behavioural differences (ordering, ID formats such as ObjectId, query semantics, transactions) cause regressions         | High       | Medium | Parity test suite run against both modules; ID-mapping strategy decided in Architecture                          |
| The abstraction leaks Mongo-specific concepts, so coupling remains                                                       | Medium     | High   | Architect review of interfaces; static checks; reference second implementation                                   |
| Large datasets cause long migration time and extended downtime                                                           | Medium     | High   | Batch and parallel loading; timing rehearsals; a later dual-write option                                         |
| Performance degradation on PostgreSQL for conversation and message workloads                                             | Medium     | Medium | Index design; load tests against baselines; tuning                                                               |
| Scope creep from the broad refactor (many services touched)                                                              | High       | Medium | Strict MVP boundary; epic-level prioritisation; change control through the BA                                    |
| Unknown dependencies on MongoDB elsewhere (third-party libraries, plugins, auth, sessions)                               | Medium     | Medium | Dependency audit in the Architecture phase                                                                       |
| Missing baselines, budget or dates reduce planning accuracy                                                              | High       | Medium | Resolve blocking questions before the architecture gate                                                          |

## Initial epic map

| Epic                                             | Outcome                                                                                                                          |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| E1. Persistence abstraction and module framework | Application services access data only through database-agnostic interfaces, with the database module selectable by configuration |
| E2. PostgreSQL schema and data model             | An approved relational schema, with versioned migrations, covering all in-scope entities                                         |
| E3. PostgreSQL persistence module                | A PostgreSQL implementation of every repository interface, at functional parity with the MongoDB module                          |
| E4. Service refactoring                          | All in-scope services use the abstraction, with no direct MongoDB dependencies left                                              |
| E5. Data migration and reconciliation tooling    | A repeatable, validated MongoDB-to-PostgreSQL data migration, with reports proving parity                                        |
| E6. Testing, performance and parity validation   | Regression, parity and load tests show the PostgreSQL module meets the KPIs                                                      |
| E7. Cutover, rollback and operations             | A rehearsed production cutover, a tested rollback, and operator runbooks and documentation                                       |

## Open questions

- **Blocking:**
  1. What is the full list of entities and collections to migrate? Is there a data-volume estimate per deployment?
  2. Which deployments are covered: a single production instance, or multiple customer or self-hosted instances?
  3. What downtime window is acceptable at cutover? Is zero-downtime or dual-write required for the MVP?
  4. What are the target dates, budget and team capacity?
  5. Can the compatibility-check results be shared as input for Architecture? Which risks or gaps did it flag?
  6. Are there other MongoDB-dependent components, such as sessions, search indexing, vector or RAG storage, or file metadata? Are they in scope?
- **Non-blocking:**
  1. Which PostgreSQL version and hosting model (managed or self-hosted) are targeted?
  2. What are the performance baselines and acceptable thresholds?
  3. What are the compliance, retention and data-residency requirements?
  4. Should the MongoDB module be kept after go-live, and for how long?
  5. Is the work to be contributed upstream to the open-source LibreChat project?
  6. Which ORM or query layer is preferred, if any? This can be left to the Architect.

## Approvals

- Scope: BA / product owner
- Consulted: Architect
