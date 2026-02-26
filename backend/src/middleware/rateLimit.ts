import rateLimit from 'express-rate-limit';

// Rate limiting is OFF by default so queries run smoothly. Set RATE_LIMIT_ENABLED=1 to enable (e.g. production).
const rateLimitEnabled = process.env.RATE_LIMIT_ENABLED === '1';

const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;
const defaultMax = process.env.NODE_ENV === 'production' ? 2000 : 15000;
const max = Number(process.env.RATE_LIMIT_MAX) || defaultMax;

const skip = () => !rateLimitEnabled;

export const rateLimiter = rateLimit({
  windowMs,
  max,
  skip,
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Stricter limit for registration when rate limiting is enabled. */
export const registerRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_REGISTER_MAX) || 5,
  message: { error: 'Too many registration attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip,
});
