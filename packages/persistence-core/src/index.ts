export type {
  Health,
  ModuleFactory,
  ModuleSource,
  PersistenceModule,
  PersistenceModuleName,
  RegistryLogEntry,
  ResolvedModuleName,
} from './registry';
export {
  PERSISTENCE_MODULE_NAMES,
  ModuleRegistry,
  parseModuleName,
  resolveModuleName,
} from './registry';
export type {
  HealthStatus,
  Id,
  NewUser,
  Persistence,
  UserAuthRecord,
  UserIdentity,
  UserPatch,
  UserRecord,
  UserRepo,
} from './ports';
export { PortError } from './errors';
export type { PortErrorKind, PortErrorOptions } from './errors';
export { runUserRepoContract } from './contract';
export type { ContractContext, ContractHarness } from './contract';
