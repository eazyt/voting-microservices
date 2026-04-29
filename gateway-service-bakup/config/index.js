const pino = require('pino');

// const config = {
//   development: {
//     name: 'gateway-service',
//     version: '1.0.0',
//     registryUrl: 'http://localhost:4000',
//     log() {
//       return pino({ level: 'debug' });
//     },
//   },
//   production: {
//     name: 'gateway-service',
//     version: '1.0.0',
//     registryUrl: 'http://localhost:4000',
//     log() {
//       return pino({ level: 'info' });
//     },
//   },
// };
const config = {
  development: {
    name: 'gateway-service',
    version: '1.0.0',
    registryUrl: process.env.REGISTRY_URL || 'http://registry-service:4000',
    log() {
      return pino({ level: 'debug' });
    }
  },
  production: {
    name: 'gateway-service',
    version: '1.0.0',
    registryUrl: process.env.REGISTRY_URL || 'http://registry-service:4000',
    log() {
      return pino({ level: 'info' });
    }
  },
};
module.exports = config;