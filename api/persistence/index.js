const { logger } = require('@librechat/data-schemas');

/** @type {import('@lcmig/persistence-core').PersistenceModule | null} */
let current = null;

/**
 * Builds the registry (adapters are required lazily so only the selected one loads),
 * resolves `PERSISTENCE_MODULE` and logs the outcome (adapter and source, no secrets).
 * Unset selects `mongo`; an unsupported value throws and fails startup.
 * @param {{ env?: NodeJS.ProcessEnv, mongoose?: import('mongoose') }} [options]
 * @returns {Promise<import('@lcmig/persistence-core').PersistenceModule>}
 */
async function initPersistence({ env = process.env, mongoose = require('mongoose') } = {}) {
  const { ModuleRegistry } = require('@lcmig/persistence-core');
  const registry = new ModuleRegistry(({ adapter, source }) =>
    logger.info(`[persistence] adapter=${adapter} source=${source}`),
  );

  registry.register('mongo', () => {
    const { createMongoModule } = require('@lcmig/persistence-mongo');
    return createMongoModule({
      connection: mongoose.connection,
      userModel: mongoose.models.User,
    });
  });

  registry.register('postgres', () => {
    const { createPostgresModule } = require('@lcmig/persistence-postgres');
    return createPostgresModule({
      databaseUrl: env.DATABASE_URL,
      poolMax: env.PG_POOL_MAX ? Number(env.PG_POOL_MAX) : undefined,
      sslMode: env.PG_SSL_MODE || undefined,
    });
  });

  current = await registry.resolve(env.PERSISTENCE_MODULE);
  return current;
}

/** @returns {import('@lcmig/persistence-core').PersistenceModule} */
function getPersistence() {
  if (!current) {
    throw new Error('Persistence is not initialised; call initPersistence() at startup');
  }
  return current;
}

/** @returns {import('@lcmig/persistence-core').UserRepo} */
function getUserRepo() {
  return getPersistence().users;
}

/** Test hook: drops the cached module. */
function resetPersistence() {
  current = null;
}

module.exports = { initPersistence, getPersistence, getUserRepo, resetPersistence };
