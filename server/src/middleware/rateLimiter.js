const rateLimit = require('express-rate-limit');

/**
 * Auth rate limiter: 30 failed attempts per 15 minutes per IP
 */
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: true,
    message: 'Too many authentication attempts from this IP. Please try again after 15 minutes.',
  },
});

/**
 * AI routes rate limiter: 20 requests per 15 minutes per user (falls back to IP)
 * Runs AFTER auth middleware so req.user is populated.
 */
const aiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { keyGeneratorIpFallback: false },
  keyGenerator: (req) => {
    // If authenticated, rate limit by user ID; otherwise fall back to IP address
    return req.user?._id ? req.user._id.toString() : req.ip;
  },
  message: {
    error: true,
    message: 'Too many AI requests. Rate limit is 20 requests per 15 minutes. Please try again later.',
  },
});

/**
 * Register rate limiter: 30 requests per hour per IP (counts ALL requests)
 */
const registerRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: true,
    message: 'Too many registration requests from this IP. Please try again after an hour.',
  },
});

/**
 * Ask AI rate limiter: 30 requests per 15 minutes per user (falls back to IP)
 * Runs AFTER auth middleware so req.user is populated.
 */
const askRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { keyGeneratorIpFallback: false },
  keyGenerator: (req) => {
    return req.user?._id ? req.user._id.toString() : req.ip;
  },
  message: {
    error: true,
    message: 'Too many ask requests. Rate limit is 30 requests per 15 minutes. Please try again later.',
  },
});

module.exports = {
  authRateLimiter,
  registerRateLimiter,
  aiRateLimiter,
  askRateLimiter,
};
