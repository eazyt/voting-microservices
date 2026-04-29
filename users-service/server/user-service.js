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
    log.error('Failed to initialize MongoDB data:', error);
  });

  // Add a request logging middleware in development mode
  if (service.get('env') === 'development') {
    service.use((req, res, next) => {
      log.debug(`${req.method}: ${req.url}`);
      return next();
    });
  }
  
  // Parse JSON bodies for POST requests
  service.use(express.json());
  service.use(express.urlencoded({ extended: true }));
  

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

  // User Registration Endpoints
  service.post('/register', async(req, res, next) => {
    try {
      const result = await createCustomSpan('users.registerUser', async (span) => {
        span.setAttributes({ 
          'operation': 'register_user',
          'user.email': req.body.email,
          'user.shortname': req.body.shortname 
        });
        return await users.registerUser(req.body);
      });
      
      log.info(`New user registered: ${result.name} (${result.shortname})`);
      return res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: result
      });
    } catch (error) {
      log.error('User registration failed:', error.message);
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  service.post('/validate', async(req, res, next) => {
    try {
      const { identifier } = req.body;
      const result = await createCustomSpan('users.validateUser', async (span) => {
        span.setAttributes({ 
          'operation': 'validate_user',
          'user.identifier': identifier 
        });
        return await users.validateUser(identifier);
      });
      
      if (result) {
        return res.json({
          success: true,
          valid: true,
          user: result
        });
      } else {
        return res.json({
          success: true,
          valid: false,
          message: 'User not found or inactive'
        });
      }
    } catch (error) {
      return next(error);
    }
  });

  service.put('/update/:shortname', async(req, res, next) => {
    try {
      const result = await createCustomSpan('users.updateUser', async (span) => {
        span.setAttributes({ 
          'operation': 'update_user',
          'user.shortname': req.params.shortname 
        });
        return await users.updateUser(req.params.shortname, req.body);
      });
      
      log.info(`User updated: ${req.params.shortname}`);
      return res.json({
        success: true,
        message: 'User updated successfully',
        data: result
      });
    } catch (error) {
      if (error.message === 'User not found') {
        return res.status(404).json({
          success: false,
          error: error.message
        });
      }
      return next(error);
    }
  });

  service.delete('/deactivate/:shortname', async(req, res, next) => {
    try {
      const result = await createCustomSpan('users.deactivateUser', async (span) => {
        span.setAttributes({ 
          'operation': 'deactivate_user',
          'user.shortname': req.params.shortname 
        });
        return await users.deactivateUser(req.params.shortname);
      });
      
      log.info(`User deactivated: ${req.params.shortname}`);
      return res.json(result);
    } catch (error) {
      if (error.message === 'User not found') {
        return res.status(404).json({
          success: false,
          error: error.message
        });
      }
      return next(error);
    }
  });

  service.get('/stats/:shortname', async(req, res, next) => {
    try {
      const result = await createCustomSpan('users.getUserStats', async (span) => {
        span.setAttributes({ 
          'operation': 'get_user_stats',
          'user.shortname': req.params.shortname 
        });
        return await users.getUserStats(req.params.shortname);
      });
      
      return res.json({
        success: true,
        data: result
      });
    } catch (error) {
      if (error.message === 'User not found') {
        return res.status(404).json({
          success: false,
          error: error.message
        });
      }
      return next(error);
    }
  });

  // Admin-specific endpoints
  service.post('/validate-admin', async(req, res, next) => {
    try {
      const { identifier } = req.body;
      const result = await createCustomSpan('users.validateAdmin', async (span) => {
        span.setAttributes({ 
          'operation': 'validate_admin',
          'admin.identifier': identifier 
        });
        return await users.validateAdmin(identifier);
      });
      
      if (result) {
        return res.json({
          success: true,
          valid: true,
          admin: result
        });
      } else {
        return res.json({
          success: true,
          valid: false,
          message: 'User not found or not an admin'
        });
      }
    } catch (error) {
      return next(error);
    }
  });

  service.post('/check-permission', async(req, res, next) => {
    try {
      const { identifier, permission } = req.body;
      const result = await createCustomSpan('users.checkAdminPermission', async (span) => {
        span.setAttributes({ 
          'operation': 'check_admin_permission',
          'admin.identifier': identifier,
          'permission': permission
        });
        return await users.checkAdminPermission(identifier, permission);
      });
      
      return res.json({
        success: true,
        ...result
      });
    } catch (error) {
      return next(error);
    }
  });

  service.get('/all-users', async(req, res, next) => {
    try {
      // This endpoint requires admin authentication
      const adminId = req.headers['x-admin-id'];
      if (!adminId) {
        return res.status(401).json({
          success: false,
          error: 'Admin authentication required'
        });
      }

      // Validate admin
      const admin = await users.validateAdmin(adminId);
      if (!admin) {
        return res.status(403).json({
          success: false,
          error: 'Admin access required'
        });
      }

      const result = await createCustomSpan('users.getAllUsers', async (span) => {
        span.setAttributes({ 
          'operation': 'get_all_users',
          'admin.shortname': admin.shortname
        });
        return await users.getAllUsers();
      });
      
      log.info(`Admin ${admin.shortname} accessed all users list`);
      return res.json({
        success: true,
        data: result,
        count: result.length
      });
    } catch (error) {
      return next(error);
    }
  });

  service.post('/promote-admin/:shortname', async(req, res, next) => {
    try {
      const { shortname } = req.params;
      const adminId = req.headers['x-admin-id'];
      
      if (!adminId) {
        return res.status(401).json({
          success: false,
          error: 'Admin authentication required'
        });
      }

      const result = await createCustomSpan('users.promoteToAdmin', async (span) => {
        span.setAttributes({ 
          'operation': 'promote_to_admin',
          'target.shortname': shortname,
          'admin.shortname': adminId
        });
        return await users.promoteToAdmin(shortname, adminId);
      });
      
      log.info(`User ${shortname} promoted to admin by ${adminId}`);
      return res.json(result);
    } catch (error) {
      if (error.message.includes('Only admins') || error.message.includes('does not have')) {
        return res.status(403).json({
          success: false,
          error: error.message
        });
      }
      if (error.message === 'User not found or inactive') {
        return res.status(404).json({
          success: false,
          error: error.message
        });
      }
      return next(error);
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
