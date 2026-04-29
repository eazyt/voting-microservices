const path = require('path')
const pino = require('pino');
// Load package.json
const pjs = require('../package.json');

// Get some meta info from the package.json
const { name, version } = pjs;

// Set up a logger
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
    data: {
      users: path.join(__dirname, '../data/users.json'),
    },
    mongodb: {
      mongoUrl: process.env.MONGODB_URL || 'mongodb://root:example@localhost:27017',
      dbName: process.env.MONGODB_DB || 'userservice'
    },
    log: () => getLogger(name, version, 'debug'),
    registryUrl: process.env.REGISTRY_URL || 'http://localhost:4000'
  },
  production: {
    name,
    version,
    serviceTimeout: 30,
    data: {
      users: path.join(__dirname, '../data/users.json'),
    },
    mongodb: {
      mongoUrl: process.env.MONGODB_URL || 'mongodb://root:example@localhost:27017',
      dbName: process.env.MONGODB_DB || 'userservice'
    },
    log: () => getLogger(name, version, 'info'),
    registryUrl: process.env.REGISTRY_URL || 'http://localhost:4000'
  },
  test: {
    name,
    version,
    serviceTimeout: 30,
    data: {
      users: path.join(__dirname, '../data/users.json'),
    },
    mongodb: {
      mongoUrl: 'mongodb://root:example@localhost:27017',
      dbName: 'userservice_test'
    },
    log: () => getLogger(name, version, 'fatal'),
  },
};
