const path = require('path');
const pino = require('pino');

// Load package.json
const pjs = require('../package.json');

// Get some meta info from the package.json
const { name, version } = pjs;

// Set up a logger
// const getLogger = (serviceName, serviceVersion, level) =>
//   pino({
//     name: `${serviceName}:${serviceVersion}`,
//     level,
//     // optional: pretty print in dev
//     transport: process.env.NODE_ENV === 'development'
//       ? {
//           target: 'pino-pretty',
//           options: { colorize: true }
//         }
//       : undefined
//   });
const getLogger = (serviceName, serviceVersion, level) =>
  pino({
    name: `${serviceName}:${serviceVersion}`,
    level
  });

// Configuration options for different environments
module.exports = {
  development: {
    name,
    version,
    serviceTimeout: 30,
    registryUrl: process.env.REGISTRY_URL || 'http://localhost:4000',
    mongodb: {
      mongoUrl: process.env.MONGODB_URL || 'mongodb://root:example@localhost:27017',
      dbName: process.env.MONGODB_DB || 'productservice'
    },
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      username: process.env.REDIS_USERNAME || 'default',
      password: process.env.REDIS_PASSWORD || 'votingpass123'
    },
    log: () => getLogger(name, version, 'debug'),
  },
  production: {
    name,
    version,
    serviceTimeout: 30,
    registryUrl: process.env.REGISTRY_URL || 'http://localhost:4000',
    mongodb: {
      mongoUrl: process.env.MONGODB_URL || 'mongodb://root:example@localhost:27017',
      dbName: process.env.MONGODB_DB || 'productservice'
    },
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      username: process.env.REDIS_USERNAME || 'default',
      password: process.env.REDIS_PASSWORD || 'votingpass123'
    },
    log: () => getLogger(name, version, 'info'),
  },
  test: {
    name,
    version,
    serviceTimeout: 30,
    registryUrl: 'http://localhost:4000',
    mongodb: {
      mongoUrl: 'mongodb://localhost:27017',
      dbName: 'productservice_test'
    },
    redis: {
      host: 'localhost',
      port: 6379,
      username: 'default',
      password: 'votingpass123'
    },
    log: () => getLogger(name, version, 'fatal'),
  },
};