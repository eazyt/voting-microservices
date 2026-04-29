const { NodeSDK } = require('@opentelemetry/sdk-node');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { JaegerExporter } = require('@opentelemetry/exporter-jaeger');
const { ConsoleSpanExporter } = require('@opentelemetry/sdk-trace-node');
const { PeriodicExportingMetricReader } = require('@opentelemetry/sdk-metrics');
const { PrometheusExporter } = require('@opentelemetry/exporter-prometheus');

// Get service name from package.json or environment
let serviceName = 'unknown-service';
try {
  const packageJson = require('./package.json');
  serviceName = packageJson.name || 'unknown-service';
} catch (error) {
  // Fallback to environment variable or default
  serviceName = process.env.SERVICE_NAME || 'unknown-service';
}

// Configuration
const config = {
  serviceName,
  serviceVersion: process.env.SERVICE_VERSION || '1.0.0',
  environment: process.env.NODE_ENV || 'development',
  jaegerEndpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
  enableConsoleExporter: process.env.ENABLE_CONSOLE_TRACING === 'true' || process.env.NODE_ENV === 'development',
  enableJaegerExporter: process.env.ENABLE_JAEGER_TRACING !== 'false',
  enablePrometheusMetrics: process.env.ENABLE_PROMETHEUS_METRICS !== 'false',
  prometheusPort: parseInt(process.env.PROMETHEUS_PORT) || 9090
};

// Create resource with service information
const resource = new Resource({
  [SemanticResourceAttributes.SERVICE_NAME]: config.serviceName,
  [SemanticResourceAttributes.SERVICE_VERSION]: config.serviceVersion,
  [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: config.environment,
  [SemanticResourceAttributes.SERVICE_INSTANCE_ID]: `${config.serviceName}-${process.pid}`,
});

// Configure trace exporters
const traceExporters = [];

if (config.enableConsoleExporter) {
  traceExporters.push(new ConsoleSpanExporter());
}

if (config.enableJaegerExporter) {
  traceExporters.push(new JaegerExporter({
    endpoint: config.jaegerEndpoint,
  }));
}

// Configure metric exporters
const metricReaders = [];

if (config.enablePrometheusMetrics) {
  metricReaders.push(new PeriodicExportingMetricReader({
    exporter: new PrometheusExporter({
      port: config.prometheusPort,
    }),
    exportIntervalMillis: 5000,
  }));
}

// Initialize the SDK
const sdk = new NodeSDK({
  resource,
  traceExporter: traceExporters.length > 0 ? traceExporters[0] : undefined,
  metricReader: metricReaders.length > 0 ? metricReaders[0] : undefined,
  instrumentations: [
    getNodeAutoInstrumentations({
      // Disable some instrumentations that might be too verbose
      '@opentelemetry/instrumentation-fs': {
        enabled: false,
      },
      // Enable specific instrumentations we care about
      '@opentelemetry/instrumentation-http': {
        enabled: true,
        requestHook: (span, request) => {
          span.setAttributes({
            'http.request.body.size': request.headers['content-length'] || 0,
            'user.agent': request.headers['user-agent'] || 'unknown',
          });
        },
        responseHook: (span, response) => {
          span.setAttributes({
            'http.response.body.size': response.headers['content-length'] || 0,
          });
        },
      },
      '@opentelemetry/instrumentation-express': {
        enabled: true,
      },
      '@opentelemetry/instrumentation-mongodb': {
        enabled: true,
      },
      '@opentelemetry/instrumentation-redis': {
        enabled: true,
      },
    }),
  ],
});

// Custom middleware for additional tracing
function createTracingMiddleware() {
  const { trace, context } = require('@opentelemetry/api');
  
  return (req, res, next) => {
    const tracer = trace.getTracer(config.serviceName);
    const span = tracer.startSpan(`${req.method} ${req.path}`, {
      kind: 1, // SERVER
      attributes: {
        'http.method': req.method,
        'http.url': req.url,
        'http.path': req.path,
        'http.user_agent': req.headers['user-agent'],
        'service.name': config.serviceName,
        'service.version': config.serviceVersion,
      },
    });

    // Add custom attributes
    if (req.params) {
      Object.keys(req.params).forEach(key => {
        span.setAttribute(`http.params.${key}`, req.params[key]);
      });
    }

    if (req.query) {
      Object.keys(req.query).forEach(key => {
        span.setAttribute(`http.query.${key}`, req.query[key]);
      });
    }

    // Wrap response to capture status code
    const originalSend = res.send;
    res.send = function(data) {
      span.setAttributes({
        'http.status_code': res.statusCode,
        'http.response.size': Buffer.byteLength(data || ''),
      });
      
      if (res.statusCode >= 400) {
        span.recordException(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
      }
      
      span.end();
      return originalSend.call(this, data);
    };

    // Handle errors
    res.on('error', (error) => {
      span.recordException(error);
      span.setStatus({ code: 2, message: error.message }); // ERROR
      span.end();
    });

    // Continue with request in span context
    context.with(trace.setSpan(context.active(), span), () => {
      next();
    });
  };
}

// Custom function to create spans for business logic
function createCustomSpan(name, fn, attributes = {}) {
  const { trace } = require('@opentelemetry/api');
  const tracer = trace.getTracer(config.serviceName);
  
  return tracer.startActiveSpan(name, { attributes }, async (span) => {
    try {
      const result = await fn(span);
      span.setStatus({ code: 1 }); // OK
      return result;
    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: 2, message: error.message }); // ERROR
      throw error;
    } finally {
      span.end();
    }
  });
}

// Initialize tracing
try {
  sdk.start();
  console.log(`🔍 OpenTelemetry tracing initialized for service: ${config.serviceName}`);
  console.log(`📊 Jaeger endpoint: ${config.jaegerEndpoint}`);
  console.log(`📈 Prometheus metrics port: ${config.prometheusPort}`);
} catch (error) {
  console.error('❌ Failed to initialize OpenTelemetry:', error);
}

// Graceful shutdown
process.on('SIGTERM', () => {
  sdk.shutdown()
    .then(() => console.log('🔍 OpenTelemetry terminated'))
    .catch((error) => console.error('❌ Error terminating OpenTelemetry', error))
    .finally(() => process.exit(0));
});

module.exports = {
  sdk,
  createTracingMiddleware,
  createCustomSpan,
  config,
};