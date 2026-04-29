const helmet = require('helmet');
const { body, validationResult } = require('express-validator');

// Security headers
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

// Request size limiting
const requestSizeLimiter = (req, res, next) => {
  const maxSize = 1024 * 1024; // 1MB
  if (req.headers['content-length'] && parseInt(req.headers['content-length']) > maxSize) {
    return res.status(413).json({
      error: 'Request entity too large',
      maxSize: '1MB'
    });
  }
  next();
};

// IP whitelist/blacklist
const ipFilter = (req, res, next) => {
  const clientIP = req.ip || req.connection.remoteAddress;
  
  // Blacklisted IPs (could be loaded from database/config)
  const blacklistedIPs = process.env.BLACKLISTED_IPS ? 
    process.env.BLACKLISTED_IPS.split(',') : [];
  
  if (blacklistedIPs.includes(clientIP)) {
    return res.status(403).json({
      error: 'Access denied',
      reason: 'IP blocked'
    });
  }
  
  next();
};

// Request validation
const validateRequest = [
  body('*').escape(), // Sanitize all input
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: errors.array()
      });
    }
    next();
  }
];

// Connection limiting per IP
const connectionLimiter = (() => {
  const connections = new Map();
  const maxConnections = 10;
  
  return (req, res, next) => {
    const clientIP = req.ip;
    const current = connections.get(clientIP) || 0;
    
    if (current >= maxConnections) {
      return res.status(429).json({
        error: 'Too many concurrent connections from this IP'
      });
    }
    
    connections.set(clientIP, current + 1);
    
    res.on('finish', () => {
      const updated = connections.get(clientIP) - 1;
      if (updated <= 0) {
        connections.delete(clientIP);
      } else {
        connections.set(clientIP, updated);
      }
    });
    
    next();
  };
})();

module.exports = {
  securityHeaders,
  requestSizeLimiter,
  ipFilter,
  validateRequest,
  connectionLimiter
};