const { logger } = require('@librechat/data-schemas');
const { errorsToString } = require('librechat-data-provider');
const { Strategy: PassportLocalStrategy } = require('passport-local');
const {
  isEnabled,
  comparePassword,
  grandfatherLegacyEmailVerification,
  compareSecret,
} = require('@librechat/api');
const { getUserRepo } = require('~/persistence');
const { loginSchema } = require('./validators');

/**
 * Adapts a port record to the shape the login controller and downstream code read
 * (`_id`, `password`); the id is the adapter's opaque string.
 */
function toLoginUser({ passwordHash, ...record }) {
  return { ...record, _id: record.id, password: passwordHash ?? undefined };
}

async function validateLoginRequest(req) {
  const { error } = loginSchema.safeParse(req.body);
  return error ? errorsToString(error.errors) : null;
}

async function passportLogin(req, email, password, done) {
  try {
    const validationError = await validateLoginRequest(req);
    if (validationError) {
      logError('Passport Local Strategy - Validation Error', { email: req.body?.email });
      logger.error(`[Login] [Login failed] [Username: ${email}] [Request-IP: ${req.ip}]`);
      return done(null, false, { message: validationError });
    }

    const users = getUserRepo();
    const record = await users.getAuthByEmail(email.trim());
    const user = record ? toLoginUser(record) : null;
    if (!user) {
      logError('Passport Local Strategy - User Not Found', { email });
      logger.error(`[Login] [Login failed] [Username: ${email}] [Request-IP: ${req.ip}]`);
      return done(null, false, { message: 'Email does not exist.' });
    }

    if (!user.password) {
      logError('Passport Local Strategy - User has no password', { email });
      logger.error(`[Login] [Login failed] [Username: ${email}] [Request-IP: ${req.ip}]`);
      return done(null, false, { message: 'Email does not exist.' });
    }

    const isMatch = await comparePassword(user, password, { compare: compareSecret });
    if (!isMatch) {
      logError('Passport Local Strategy - Password does not match', { isMatch });
      logger.error(`[Login] [Login failed] [Username: ${email}] [Request-IP: ${req.ip}]`);
      return done(null, false, { message: 'Incorrect password.' });
    }

    const updateUser = (id, patch) => users.update(id, patch);
    await grandfatherLegacyEmailVerification({ updateUser }, user);

    const unverifiedAllowed = isEnabled(process.env.ALLOW_UNVERIFIED_EMAIL_LOGIN);
    if (user.expiresAt && unverifiedAllowed) {
      await users.update(user._id, { expiresAt: null });
    }

    if (!user.emailVerified && !unverifiedAllowed) {
      logError('Passport Local Strategy - Email not verified', { email });
      logger.error(`[Login] [Login failed] [Username: ${email}] [Request-IP: ${req.ip}]`);
      return done(null, user, { message: 'Email not verified.' });
    }

    logger.info(`[Login] [Login successful] [Username: ${email}] [Request-IP: ${req.ip}]`);
    return done(null, user);
  } catch (err) {
    return done(err);
  }
}

function logError(title, parameters) {
  const entries = Object.entries(parameters).map(([name, value]) => ({ name, value }));
  logger.error(title, { parameters: entries });
}

module.exports = () =>
  new PassportLocalStrategy(
    {
      usernameField: 'email',
      passwordField: 'password',
      session: false,
      passReqToCallback: true,
    },
    passportLogin,
  );
