import type { UserRepo } from './ports';

export const PERSISTENCE_MODULE_NAMES = ['mongo', 'postgres'] as const;
export type PersistenceModuleName = (typeof PERSISTENCE_MODULE_NAMES)[number];

export interface Health {
  ok: boolean;
  adapter: PersistenceModuleName;
}

/** Adapter contract; repository ports are added per slice (see ADR-001). */
export interface PersistenceModule {
  readonly name: PersistenceModuleName;
  readonly users: UserRepo;
  health(): Promise<Health>;
  close(): Promise<void>;
}

export type ModuleSource = 'env' | 'default';

export interface ResolvedModuleName {
  name: PersistenceModuleName;
  source: ModuleSource;
}

export type ModuleFactory = () => PersistenceModule | Promise<PersistenceModule>;

export interface RegistryLogEntry {
  adapter: PersistenceModuleName;
  source: ModuleSource;
}

/** Unset or blank selects `mongo` (A-2); an unknown value throws. */
export function resolveModuleName(value: string | undefined): ResolvedModuleName {
  const trimmed = value?.trim();
  if (!trimmed) {
    return { name: 'mongo', source: 'default' };
  }
  const match = PERSISTENCE_MODULE_NAMES.find((n) => n === trimmed);
  if (!match) {
    throw new Error(
      `Unknown PERSISTENCE_MODULE "${trimmed}"; expected one of ${PERSISTENCE_MODULE_NAMES.join(', ')}`,
    );
  }
  return { name: match, source: 'env' };
}

export function parseModuleName(value: string | undefined): PersistenceModuleName {
  return resolveModuleName(value).name;
}

export class ModuleRegistry {
  private readonly factories = new Map<PersistenceModuleName, ModuleFactory>();

  constructor(private readonly log: (entry: RegistryLogEntry) => void = () => undefined) {}

  register(name: PersistenceModuleName, factory: ModuleFactory): void {
    this.factories.set(name, factory);
  }

  /** Builds only the adapter named by PERSISTENCE_MODULE and logs the outcome. */
  async resolve(value: string | undefined): Promise<PersistenceModule> {
    const { name, source } = resolveModuleName(value);
    const factory = this.factories.get(name);
    if (!factory) {
      throw new Error(`Persistence module "${name}" is not registered`);
    }
    const module = await factory();
    this.log({ adapter: name, source });
    return module;
  }
}
