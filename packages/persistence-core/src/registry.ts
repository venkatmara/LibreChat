import { Persistence } from './ports';

export type PersistenceFactory = () => Promise<Persistence> | Persistence;

const factories = new Map<string, PersistenceFactory>();

export function registerPersistence(name: string, factory: PersistenceFactory): void {
  factories.set(name, factory);
}

/** Resolves the adapter named by PERSISTENCE_MODULE (default: mongo). */
export async function createPersistence(
  name: string = process.env.PERSISTENCE_MODULE ?? 'mongo',
): Promise<Persistence> {
  const factory = factories.get(name);
  if (!factory) {
    throw new Error(
      `Unknown PERSISTENCE_MODULE "${name}"; registered: ${[...factories.keys()].join(', ') || 'none'}`,
    );
  }
  return factory();
}

export function clearRegistry(): void {
  factories.clear();
}
