const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const redis = require('redis');

// Redis client for distributed rate limiting
let redisClient;
if (process.env.REDIS_HOST) {
  redisClient = redis.createClient({
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD
  });
}

// Basic rate limiter - 100 requests per 15 minutes
const basicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Use Redis for distributed rate limiting if available
  store: redisClient ? new (require('rate-limit-redis'))({
    client: redisClient,
    prefix: 'rl:basic:'
  }) : undefined
});

// Strict rate limiter for sensitive endpoints
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // only 20 requests per 15 minutes
  message: {
    error: 'Rate limit exceeded for sensitive endpoint',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: redisClient ? new (require('rate-limit-redis'))({
    client: redisClient,
    prefix: 'rl:strict:'
  }) : undefined
});

// Progressive delay for repeated requests
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 50, // allow 50 requests per windowMs without delay
  delayMs: 500, // add 500ms delay per request after delayAfter
  maxDelayMs: 20000, // max delay of 20 seconds
  store: redisClient ? new (require('rate-limit-redis'))({
    client: redisClient,
    prefix: 'sd:'
  }) : undefined
});

// DDoS protection - very aggressive limiting
const ddosProtection = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: {
    error: 'DDoS protection activated. Please slow down your requests.',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health';
  },
  store: redisClient ? new (require('rate-limit-redis'))({
    client: redisClient,
    prefix: 'rl:ddos:'
  }) : undefined
});

// IP-based blocking for suspicious activity
const suspiciousActivityLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 1000, // 1000 requests per hour
  message: {
    error: 'Suspicious activity detected. IP temporarily blocked.',
    retryAfter: '1 hour'
  },
  onLimitReached: (req, res, options) => {
    console.warn(`IP ${req.ip} has been rate limited for suspicious activity`);
    // Log to monitoring system
  },
  store: redisClient ? new (require('rate-limit-redis'))({
    client: redisClient,
    prefix: 'rl:suspicious:'
  }) : undefined
});

module.exports = {
  basicLimiter,
  strictLimiter,
  speedLimiter,
  ddosProtection,
  suspiciousActivityLimiter
};