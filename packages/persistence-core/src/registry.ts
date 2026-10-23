export const PERSISTENCE_MODULE_NAMES = ['mongo', 'postgres'] as const;
export type PersistenceModuleName = (typeof PERSISTENCE_MODULE_NAMES)[number];

export interface Health {
  ok: boolean;
  adapter: PersistenceModuleName;
}

/** Minimal adapter contract; repository ports are added per slice (see ADR-001). */
export interface PersistenceModule {
  readonly name: PersistenceModuleName;
  health(): Promise<Health>;
}

export function parseModuleName(value: string | undefined): PersistenceModuleName {
  const name = value ?? 'mongo';
  const match = PERSISTENCE_MODULE_NAMES.find((n) => n === name);
  if (!match) {
    throw new Error(
      `Unknown PERSISTENCE_MODULE "${name}"; expected one of ${PERSISTENCE_MODULE_NAMES.join(', ')}`,
    );
  }
  return match;
}

export class ModuleRegistry {
  private readonly modules = new Map<PersistenceModuleName, PersistenceModule>();

  register(module: PersistenceModule): void {
    this.modules.set(module.name, module);
  }

  /** Selects the adapter named by PERSISTENCE_MODULE (default `mongo` until cutover). */
  resolve(value: string | undefined): PersistenceModule {
    const name = parseModuleName(value);
    const module = this.modules.get(name);
    if (!module) {
      throw new Error(`Persistence module "${name}" is not registered`);
    }
    return module;
  }
}
