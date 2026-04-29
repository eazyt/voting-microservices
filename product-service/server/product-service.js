const express = require('express');
const ProductService = require('./lib/product-data');
const { createTracingMiddleware, createCustomSpan } = require('../tracing');
const service = express();

module.exports = (config) => {
  const log = config.log();

  const products = new ProductService(config.mongodb, config.redis);
  
  // Add OpenTelemetry tracing middleware
  service.use(createTracingMiddleware());
  
  // Initialize MongoDB data on startup
  products.initializeData().catch(error => {
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

  // Parse JSON bodies
  service.use(express.json());

  // Get all products
  service.get('/products', async (req, res, next) => {
    try {
      const allProducts = await products.getAllProducts();
      return res.json(allProducts);
    } catch (error) {
      log.error('Error getting products:', error);
      return next(error);
    }
  });

  // Get specific product
  service.get('/products/:productId', async (req, res, next) => {
    try {
      const product = await products.getProduct(req.params.productId);
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }
      return res.json(product);
    } catch (error) {
      log.error('Error getting product:', error);
      return next(error);
    }
  });

  // Get products by category
  service.get('/products/category/:category', async (req, res, next) => {
    try {
      const categoryProducts = await products.getProductsByCategory(req.params.category);
      return res.json(categoryProducts);
    } catch (error) {
      log.error('Error getting products by category:', error);
      return next(error);
    }
  });

  // Vote for a product (POST) - now queues to Redis
  service.post('/vote/:productId', async (req, res, next) => {
    try {
      const { productId } = req.params;
      const { userId } = req.body;
      const userIp = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
      
      const result = await products.voteForProduct(productId, userId, userIp);
      log.info(`Vote queued for product ${productId} from IP ${userIp}`);
      return res.json(result);
    } catch (error) {
      if (error.message === 'Product not found') {
        return res.status(404).json({ error: error.message });
      }
      log.error('Error queuing vote:', error);
      return next(error);
    }
  });

  // Get real-time vote count from Redis (immediate feedback)
  service.get('/votes-realtime/:productId', async (req, res, next) => {
    try {
      const redisCount = await products.getRedisVoteCount(req.params.productId);
      const mongoVotes = await products.getProductVotes(req.params.productId);
      
      return res.json({
        productId: req.params.productId,
        pendingVotes: redisCount,
        persistedVotes: mongoVotes.totalVotes,
        totalEstimated: redisCount + mongoVotes.totalVotes
      });
    } catch (error) {
      log.error('Error getting real-time votes:', error);
      return next(error);
    }
  });

  // Get votes for a specific product
  service.get('/votes/:productId', async (req, res, next) => {
    try {
      const votes = await products.getProductVotes(req.params.productId);
      return res.json(votes);
    } catch (error) {
      log.error('Error getting product votes:', error);
      return next(error);
    }
  });

  // Get top voted products
  service.get('/top-products', async (req, res, next) => {
    try {
      const limit = parseInt(req.query.limit) || 10;
      const topProducts = await products.getTopProducts(limit);
      return res.json(topProducts);
    } catch (error) {
      log.error('Error getting top products:', error);
      return next(error);
    }
  });

  // Get all vote statistics
  service.get('/vote-stats', async (req, res, next) => {
    try {
      const stats = await products.getAllVoteStats();
      return res.json(stats);
    } catch (error) {
      log.error('Error getting vote stats:', error);
      return next(error);
    }
  });

  // Admin-only product management endpoints
  service.post('/admin/create', async (req, res, next) => {
    try {
      const adminId = req.headers['x-admin-id'];
      if (!adminId) {
        return res.status(401).json({
          success: false,
          error: 'Admin authentication required'
        });
      }

      const result = await createCustomSpan('products.createProduct', async (span) => {
        span.setAttributes({ 
          'operation': 'create_product',
          'admin.id': adminId,
          'product.name': req.body.name
        });
        return await products.createProduct(req.body, adminId);
      });
      
      log.info(`Product created: ${result.name} by admin ${adminId}`);
      return res.status(201).json({
        success: true,
        message: 'Product created successfully',
        data: result
      });
    } catch (error) {
      if (error.message.includes('Missing required fields') || error.message.includes('already exists')) {
        return res.status(400).json({
          success: false,
          error: error.message
        });
      }
      return next(error);
    }
  });

  service.put('/admin/update/:productId', async (req, res, next) => {
    try {
      const adminId = req.headers['x-admin-id'];
      if (!adminId) {
        return res.status(401).json({
          success: false,
          error: 'Admin authentication required'
        });
      }

      const { productId } = req.params;
      const result = await createCustomSpan('products.updateProduct', async (span) => {
        span.setAttributes({ 
          'operation': 'update_product',
          'admin.id': adminId,
          'product.id': productId
        });
        return await products.updateProduct(productId, req.body, adminId);
      });
      
      log.info(`Product updated: ${productId} by admin ${adminId}`);
      return res.json({
        success: true,
        message: 'Product updated successfully',
        data: result
      });
    } catch (error) {
      if (error.message === 'Product not found') {
        return res.status(404).json({
          success: false,
          error: error.message
        });
      }
      if (error.message.includes('already exists')) {
        return res.status(400).json({
          success: false,
          error: error.message
        });
      }
      return next(error);
    }
  });

  service.delete('/admin/delete/:productId', async (req, res, next) => {
    try {
      const adminId = req.headers['x-admin-id'];
      if (!adminId) {
        return res.status(401).json({
          success: false,
          error: 'Admin authentication required'
        });
      }

      const { productId } = req.params;
      const result = await createCustomSpan('products.deleteProduct', async (span) => {
        span.setAttributes({ 
          'operation': 'delete_product',
          'admin.id': adminId,
          'product.id': productId
        });
        return await products.deleteProduct(productId, adminId);
      });
      
      log.info(`Product deleted: ${productId} by admin ${adminId} (${result.softDelete ? 'soft' : 'hard'} delete)`);
      return res.json(result);
    } catch (error) {
      if (error.message === 'Product not found') {
        return res.status(404).json({
          success: false,
          error: error.message
        });
      }
      return next(error);
    }
  });

  // Health check with MongoDB connectivity test
  service.get('/health', async (req, res) => {
    try {
      // Basic health check
      const healthStatus = {
        status: 'healthy',
        service: config.name,
        version: config.version,
        timestamp: new Date().toISOString()
      };

      // Test MongoDB connection
      try {
        await products.connect();
        const testCollection = products.db.collection('health_check');
        await testCollection.insertOne({ test: true, timestamp: new Date() });
        await testCollection.deleteOne({ test: true });
        healthStatus.mongodb = 'connected';
      } catch (mongoError) {
        healthStatus.mongodb = 'disconnected';
        healthStatus.mongoError = mongoError.message;
      }

      // Test Redis connection if available
      try {
        await products.connectRedis();
        await products.redisClient.ping();
        healthStatus.redis = 'connected';
      } catch (redisError) {
        healthStatus.redis = 'disconnected';
        healthStatus.redisError = redisError.message;
      }

      res.json(healthStatus);
    } catch (error) {
      res.status(500).json({
        status: 'unhealthy',
        service: config.name,
        version: config.version,
        timestamp: new Date().toISOString(),
        error: error.message
      });
    }
  });

  // Error handling middleware
  service.use((error, req, res, next) => {
    res.status(error.status || 500);
    log.error(error);
    return res.json({
      error: {
        message: error.message,
      },
    });
  });

  return service;
};