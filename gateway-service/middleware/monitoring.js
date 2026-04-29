const { register, Counter, Histogram, Gauge } = require('prom-client');

// Metrics for DDoS detection
const requestCounter = new Counter({
  name: 'gateway_requests_total',
  help: 'Total number of requests',
  labelNames: ['method', 'route', 'status_code', 'ip']
});

const requestDuration = new Histogram({
  name: 'gateway_request_duration_seconds',
  help: 'Request duration in seconds',
  labelNames: ['method', 'route', 'status_code']
});

const rateLimitCounter = new Counter({
  name: 'gateway_rate_limit_hits_total',
  help: 'Number of rate limit hits',
  labelNames: ['limiter_type', 'ip']
});

const activeConnections = new Gauge({
  name: 'gateway_active_connections',
  help: 'Number of active connections'
});

const suspiciousActivityCounter = new Counter({
  name: 'gateway_suspicious_activity_total',
  help: 'Number of suspicious activities detected',
  labelNames: ['type', 'ip']
});

// Middleware to track metrics
const metricsMiddleware = (req, res, next) => {
  const start = Date.now();
  
  // Track active connections
  activeConnections.inc();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route ? req.route.path : req.path;
    
    requestCounter.inc({
      method: req.method,
      route: route,
      status_code: res.statusCode,
      ip: req.ip
    });
    
    requestDuration.observe({
      method: req.method,
      route: route,
      status_code: res.statusCode
    }, duration);
    
    activeConnections.dec();
  });
  
  next();
};

// DDoS detection based on metrics
const detectDDoS = (req, res, next) => {
  const clientIP = req.ip;
  
  // Check for suspicious patterns
  const suspiciousPatterns = [
    // Too many requests in short time
    req.headers['user-agent'] === '',
    // Missing common headers
    !req.headers['accept'],
    // Suspicious user agents
    /bot|crawler|spider/i.test(req.headers['user-agent'] || ''),
    // Unusual request methods
    !['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'].includes(req.method)
  ];
  
  if (suspiciousPatterns.some(pattern => pattern)) {
    suspiciousActivityCounter.inc({
      type: 'suspicious_request',
      ip: clientIP
    });
    
    console.warn(`Suspicious activity detected from IP: ${clientIP}`, {
      userAgent: req.headers['user-agent'],
      method: req.method,
      path: req.path
    });
  }
  
  next();
};

// Rate limit hit tracking
const trackRateLimit = (limiterType) => {
  return (req, res, next) => {
    const originalSend = res.send;
    res.send = function(data) {
      if (res.statusCode === 429) {
        rateLimitCounter.inc({
          limiter_type: limiterType,
          ip: req.ip
        });
      }
      originalSend.call(this, data);
    };
    next();
  };
};

module.exports = {
  metricsMiddleware,
  detectDDoS,
  trackRateLimit,
  register
};