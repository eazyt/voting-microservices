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
    log: () => getLogger(name, version, 'debug'),
  },
  production: {
    name,
    version,
    serviceTimeout: 30,
    log: () => getLogger(name, version, 'info'),
  },
  test: {
    name,
    version,
    serviceTimeout: 30,
    log: () => getLogger(name, version, 'fatal'),
  },
};
