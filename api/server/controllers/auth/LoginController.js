const { createLoginController, clearCloudFrontCookies } = require('@librechat/api');
const { generate2FATempToken } = require('~/server/services/twoFactorService');
const { getUserById: getMongoUserById, deleteAllUserSessions } = require('~/models');
const { getPersistence } = require('~/persistence');
const { setAuthTokens } = require('~/server/services/AuthService');

/**
 * Password-reset recheck reads `credentialsChangedAt`, which is not copied to Postgres in this
 * slice, so on non-mongo adapters there is nothing to compare against.
 */
const getUserById = (userId, projection) =>
  getPersistence().name === 'mongo' ? getMongoUserById(userId, projection) : Promise.resolve(null);

const loginController = createLoginController({
  generate2FATempToken,
  getUserById,
  deleteAllUserSessions,
  setAuthTokens,
  clearCloudFrontCookies,
});

module.exports = { loginController };
