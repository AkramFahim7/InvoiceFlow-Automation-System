const AppError = require('../utils/appError');

/**
 * Attach baseline HTTP security headers to all API and static responses.
 */
function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()'
  );
  next();
}

/**
 * Lightweight in-memory sliding-window rate limiter keyed by client IP and keyPrefix.
 */
function createRateLimiter({
  windowMs = 15 * 60 * 1000,
  maxRequests = 30,
  keyPrefix = 'global',
  message = 'Too many requests. Please wait a few minutes and try again.',
} = {}) {
  const hits = new Map();

  function middleware(req, res, next) {
    const now = Date.now();
    const clientIp = req.ip || req.socket?.remoteAddress || 'unknown';
    const key = `${keyPrefix}:${clientIp}`;

    const entry = hits.get(key);
    if (!entry || now > entry.resetAt) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (entry.count >= maxRequests) {
      const retryAfterSec = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      return next(new AppError(message, 429));
    }

    entry.count += 1;
    return next();
  }

  middleware._reset = () => hits.clear();
  return middleware;
}

module.exports = {
  securityHeaders,
  createRateLimiter,
};

