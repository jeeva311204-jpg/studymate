/**
 * Shared helper for JWT secret configuration.
 * Enforces that JWT_SECRET is provided and refuses to fall back to hardcoded secrets.
 */
const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret || !secret.trim()) {
    throw new Error(
      'FATAL: JWT_SECRET environment variable is missing. The server cannot start or process authentication tokens without JWT_SECRET configured in server/.env.'
    );
  }
  if (secret.trim() === 'CHANGE_ME') {
    throw new Error(
      'FATAL: JWT_SECRET is set to the placeholder "CHANGE_ME". Please configure a real, secure secret key in server/.env before starting the server.'
    );
  }
  return secret.trim();
};

module.exports = {
  getJwtSecret,
};
