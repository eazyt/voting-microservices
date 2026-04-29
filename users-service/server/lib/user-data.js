const express = require('express');
const UserService = require('./lib/user-data-mongo');
const { createTracingMiddleware, createCustomSpan } = require('../tracing');
const service = express();

module.exports = (config) => {
  const log = config.log();

  const users = new UserService(config.mongodb);
  
  // Add OpenTelemetry tracing middleware
  service.use(createTracingMiddleware());
  
  // Initialize MongoDB data on startup
  users.initializeData().catch(error => {
    log.error('Failed to initialize MongoDB data:', error.message);
    log.error('Error details:', error.stack);
    // Don't exit the process, just log the error and continue
    // The service can still handle requests even if initialization fails
  });

  // Add a request logging middleware in development mode
  if (service.get('env') === 'development') {
    service.use((req, res, next) => {
      log.debug(`${req.method}: ${req.url}`);
      return next();
    });
  }
  
  service.get('/users', (req, res) => {
    res.json([{ id: 1, name: 'Thabo' }, { id: 2, name: 'Alice' }]);
  });

  service.get('/list', async(req, res, next) => {
    try {
      const result = await createCustomSpan('users.getList', async (span) => {
        span.setAttributes({ 'operation': 'get_user_list' });
        return await users.getList();
      });
      return res.json(result);
    } catch (error) {
      console.error(error);
      return next(error)
    }
  });

  service.get('/list-short', async(req, res, next) => {
    try {
      const result = await createCustomSpan('users.getListShort', async (span) => {
        span.setAttributes({ 'operation': 'get_user_list_short' });
        return await users.getListShort();
      });
      return res.json(result);
    } catch (error) {
      return next(error)
    }
  });

  service.get('/name/:shortname', async(req, res, next) => {
    try {
      const result = await createCustomSpan('users.getUser', async (span) => {
        span.setAttributes({ 
          'operation': 'get_user_by_shortname',
          'user.shortname': req.params.shortname 
        });
        return await users.getUser(req.params.shortname);
      });
      return res.json(result);
    } catch (error) {
      return next(error)
    }
  });

  service.get('/names', async(req, res, next) => {
    try {
      const result = await createCustomSpan('users.getNames', async (span) => {
        span.setAttributes({ 'operation': 'get_user_names' });
        return await users.getNames();
      });
      return res.json(result);
    } catch (error) {
      return next(error)
    }
  });

  // Health check endpoint
  service.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      service: config.name,
      version: config.version,
      timestamp: new Date().toISOString()
    });
  });

  // eslint-disable-next-line no-unused-vars
  service.use((error, req, res, next) => {
    res.status(error.status || 500);
    // Log out the error to the console
    log.error(error);
    return res.json({
      error: {
        message: error.message,
      },
    });
  });
  return service;
};
