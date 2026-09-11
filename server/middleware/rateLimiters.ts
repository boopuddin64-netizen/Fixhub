import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for sensitive payment initialization and verification endpoints.
 */
export const paymentRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // Limit each IP to 30 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many payment requests from this IP, please try again after a minute.' },
});

/**
 * Rate limiter for incoming webhook traffic.
 */
export const webhookRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120, // 120 webhook events per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Webhook rate limit exceeded.' },
});

/**
 * Rate limiter for authentication attempts (login, registration).
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 attempts per 15 mins
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again in a few minutes.' },
});
