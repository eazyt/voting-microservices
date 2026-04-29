const express = require("express");
const axios = require("axios");
const { createTracingMiddleware, createCustomSpan } = require("../tracing");

const service = express();

module.exports = (config) => {
  const log = config.log();

  // Add OpenTelemetry tracing middleware
  service.use(createTracingMiddleware());

  // Add request logging middleware in development mode
  if (service.get("env") === "development") {
    service.use((req, res, next) => {
      log.debug(`${req.method}: ${req.url}`);
      return next();
    });
  }

  // Parse JSON bodies for POST requests
  service.use(express.json());

  // Helper function to discover all available services from registry
  const discoverAllServices = async (serviceName) => {
    try {
      // Use '*' version to get any available version of the service
      // The registry's get method will return a random instance from all matching services
      const response = await axios.get(
        `${config.registryUrl}/find/${serviceName}/*`
      );
      return response.data;
    } catch (error) {
      log.error(
        `Failed to discover services for ${serviceName}`,
        error.message
      );
      throw new Error(`Service ${serviceName} not available`);
    }
  };

  // Cache for discovered services to implement our own load balancing
  let serviceCache = {};
  let lastCacheUpdate = 0;
  const CACHE_TTL = 5000; // 5 seconds

  const getAvailableServices = async (serviceName) => {
    const now = Date.now();

    // Check if we need to refresh the cache
    if (!serviceCache[serviceName] || now - lastCacheUpdate > CACHE_TTL) {
      try {
        // Make multiple requests to get different instances (registry returns random)
        const instances = new Set();
        const maxAttempts = 10;

        for (let i = 0; i < maxAttempts; i++) {
          try {
            const service = await discoverAllServices(serviceName);
            if (service) {
              instances.add(JSON.stringify(service));
            }
          } catch (error) {
            // Continue trying
          }
        }

        serviceCache[serviceName] = Array.from(instances).map((s) =>
          JSON.parse(s)
        );
        lastCacheUpdate = now;

        log.debug(
          `Cached ${serviceCache[serviceName].length} instances of ${serviceName}`
        );
      } catch (error) {
        // If cache refresh fails, use existing cache or throw error
        if (
          !serviceCache[serviceName] ||
          serviceCache[serviceName].length === 0
        ) {
          throw error;
        }
        log.warn(
          `Using cached services for ${serviceName} due to discovery error`
        );
      }
    }

    return serviceCache[serviceName] || [];
  };

  // Load balancer - simple round robin
  let serviceIndexes = {};
  const getNextService = async (serviceName) => {
    const services = await getAvailableServices(serviceName);

    if (services.length === 0) {
      throw new Error(`No ${serviceName} instances available`);
    }

    if (!serviceIndexes[serviceName]) {
      serviceIndexes[serviceName] = 0;
    }

    const service = services[serviceIndexes[serviceName] % services.length];
    serviceIndexes[serviceName]++;

    log.debug(
      `Selected ${serviceName} instance: ${service.ip}:${service.port} (v${service.version})`
    );
    return service;
  };

  // Gateway endpoint to list users
  service.get("/user-list", async (req, res, next) => {
    try {
      const result = await createCustomSpan('gateway.user-list', async (span) => {
        span.setAttributes({ 
          'operation': 'get_user_list',
          'gateway.target_service': 'user-service'
        });
        
        // Get next available user-service instance with load balancing
        const userService = await getNextService("user-service");
        span.setAttributes({
          'service.instance.ip': userService.ip,
          'service.instance.port': userService.port,
          'service.instance.version': userService.version
        });

        // Make request to user service
        const userServiceUrl = `http://${userService.ip}:${userService.port}`;
        const response = await axios.get(`${userServiceUrl}/list`);

        log.info(
          `Successfully retrieved users from ${userServiceUrl} (v${userService.version})`
        );
        
        return {
          source: "user-service",
          serviceVersion: userService.version,
          serviceEndpoint: `${userService.ip}:${userService.port}`,
          data: response.data,
        };
      });
      
      return res.json(result);
    } catch (error) {
      log.error("Error in /user-list endpoint:", error.message);
      return next(error);
    }
  });

  // Gateway endpoint to list users (short format)
  service.get("/user-list-short", async (req, res, next) => {
    try {
      // Get next available user-service instance with load balancing
      const userService = await getNextService("user-service");

      const userServiceUrl = `http://${userService.ip}:${userService.port}`;
      const response = await axios.get(`${userServiceUrl}/list-short`);

      log.info(
        `Successfully retrieved short user list from ${userServiceUrl} (v${userService.version})`
      );
      return res.json({
        source: "user-service",
        serviceVersion: userService.version,
        serviceEndpoint: `${userService.ip}:${userService.port}`,
        data: response.data,
      });
    } catch (error) {
      log.error("Error in /user-list-short endpoint:", error.message);
      return next(error);
    }
  });

  // Gateway endpoint to get user names
  service.get("/user-names", async (req, res, next) => {
    try {
      // Get next available user-service instance with load balancing
      const userService = await getNextService("user-service");

      const userServiceUrl = `http://${userService.ip}:${userService.port}`;
      const response = await axios.get(`${userServiceUrl}/names`);

      log.info(
        `Successfully retrieved user names from ${userServiceUrl} (v${userService.version})`
      );
      return res.json({
        source: "user-service",
        serviceVersion: userService.version,
        serviceEndpoint: `${userService.ip}:${userService.port}`,
        data: response.data,
      });
    } catch (error) {
      log.error("Error in /user-names endpoint:", error.message);
      return next(error);
    }
  });

  // Gateway endpoint to get specific user by shortname
  service.get("/user/:shortname", async (req, res, next) => {
    try {
      const { shortname } = req.params;
      // Get next available user-service instance with load balancing
      const userService = await getNextService("user-service");

      const userServiceUrl = `http://${userService.ip}:${userService.port}`;
      const response = await axios.get(`${userServiceUrl}/name/${shortname}`);

      log.info(
        `Successfully retrieved user ${shortname} from ${userServiceUrl} (v${userService.version})`
      );
      return res.json({
        source: "user-service",
        serviceVersion: userService.version,
        serviceEndpoint: `${userService.ip}:${userService.port}`,
        data: response.data,
      });
    } catch (error) {
      if (error.response && error.response.status === 404) {
        return res.status(404).json({ error: "User not found" });
      }
      log.error(
        `Error in /user/${req.params.shortname} endpoint:`,
        error.message
      );
      return next(error);
    }
  });

  // User Registration Endpoints
  service.post("/register", async (req, res, next) => {
    try {
      const userService = await getNextService("user-service");
      const userServiceUrl = `http://${userService.ip}:${userService.port}`;
      const response = await axios.post(`${userServiceUrl}/register`, req.body);

      log.info(
        `User registration successful via ${userServiceUrl} (v${userService.version})`
      );
      return res.status(201).json({
        source: "user-service",
        serviceVersion: userService.version,
        serviceEndpoint: `${userService.ip}:${userService.port}`,
        ...response.data,
      });
    } catch (error) {
      if (error.response && error.response.status === 400) {
        return res.status(400).json({
          success: false,
          error: error.response.data.error || "Registration failed"
        });
      }
      log.error("Error in /register endpoint:", error.message);
      return next(error);
    }
  });

  service.post("/validate-user", async (req, res, next) => {
    try {
      const userService = await getNextService("user-service");
      const userServiceUrl = `http://${userService.ip}:${userService.port}`;
      const response = await axios.post(`${userServiceUrl}/validate`, req.body);

      log.info(
        `User validation completed via ${userServiceUrl} (v${userService.version})`
      );
      return res.json({
        source: "user-service",
        serviceVersion: userService.version,
        serviceEndpoint: `${userService.ip}:${userService.port}`,
        ...response.data,
      });
    } catch (error) {
      log.error("Error in /validate-user endpoint:", error.message);
      return next(error);
    }
  });

  service.put("/user/:shortname", async (req, res, next) => {
    try {
      const { shortname } = req.params;
      const userService = await getNextService("user-service");
      const userServiceUrl = `http://${userService.ip}:${userService.port}`;
      const response = await axios.put(`${userServiceUrl}/update/${shortname}`, req.body);

      log.info(
        `User ${shortname} updated via ${userServiceUrl} (v${userService.version})`
      );
      return res.json({
        source: "user-service",
        serviceVersion: userService.version,
        serviceEndpoint: `${userService.ip}:${userService.port}`,
        ...response.data,
      });
    } catch (error) {
      if (error.response && error.response.status === 404) {
        return res.status(404).json({ 
          success: false,
          error: "User not found" 
        });
      }
      log.error(`Error in /user/${req.params.shortname} update endpoint:`, error.message);
      return next(error);
    }
  });

  service.delete("/user/:shortname", async (req, res, next) => {
    try {
      const { shortname } = req.params;
      const userService = await getNextService("user-service");
      const userServiceUrl = `http://${userService.ip}:${userService.port}`;
      const response = await axios.delete(`${userServiceUrl}/deactivate/${shortname}`);

      log.info(
        `User ${shortname} deactivated via ${userServiceUrl} (v${userService.version})`
      );
      return res.json({
        source: "user-service",
        serviceVersion: userService.version,
        serviceEndpoint: `${userService.ip}:${userService.port}`,
        ...response.data,
      });
    } catch (error) {
      if (error.response && error.response.status === 404) {
        return res.status(404).json({ 
          success: false,
          error: "User not found" 
        });
      }
      log.error(`Error in /user/${req.params.shortname} deactivate endpoint:`, error.message);
      return next(error);
    }
  });

  // Admin Authentication and Management Endpoints
  service.post("/admin/login", async (req, res, next) => {
    try {
      const userService = await getNextService("user-service");
      const userServiceUrl = `http://${userService.ip}:${userService.port}`;
      const response = await axios.post(`${userServiceUrl}/validate-admin`, req.body);

      log.info(
        `Admin login attempt via ${userServiceUrl} (v${userService.version})`
      );
      return res.json({
        source: "user-service",
        serviceVersion: userService.version,
        serviceEndpoint: `${userService.ip}:${userService.port}`,
        ...response.data,
      });
    } catch (error) {
      log.error("Error in /admin/login endpoint:", error.message);
      return next(error);
    }
  });

  service.post("/admin/check-permission", async (req, res, next) => {
    try {
      const userService = await getNextService("user-service");
      const userServiceUrl = `http://${userService.ip}:${userService.port}`;
      const response = await axios.post(`${userServiceUrl}/check-permission`, req.body);

      return res.json({
        source: "user-service",
        serviceVersion: userService.version,
        serviceEndpoint: `${userService.ip}:${userService.port}`,
        ...response.data,
      });
    } catch (error) {
      log.error("Error in /admin/check-permission endpoint:", error.message);
      return next(error);
    }
  });

  // Admin Product Management Endpoints
  service.post("/admin/products", async (req, res, next) => {
    try {
      // Validate admin permission first
      const adminId = req.headers['x-admin-id'];
      if (!adminId) {
        return res.status(401).json({
          success: false,
          error: 'Admin authentication required'
        });
      }

      const userService = await getNextService("user-service");
      const userServiceUrl = `http://${userService.ip}:${userService.port}`;
      const permissionCheck = await axios.post(`${userServiceUrl}/check-permission`, {
        identifier: adminId,
        permission: 'product_create'
      });

      if (!permissionCheck.data.hasPermission) {
        return res.status(403).json({
          success: false,
          error: 'Admin does not have product creation permission'
        });
      }

      // Create product
      const productService = await getNextService("product-service");
      const productServiceUrl = `http://${productService.ip}:${productService.port}`;
      const response = await axios.post(`${productServiceUrl}/admin/create`, req.body, {
        headers: {
          'x-admin-id': adminId
        }
      });

      log.info(
        `Product created by admin ${adminId} via ${productServiceUrl} (v${productService.version})`
      );
      return res.status(201).json({
        source: "product-service",
        serviceVersion: productService.version,
        serviceEndpoint: `${productService.ip}:${productService.port}`,
        ...response.data,
      });
    } catch (error) {
      if (error.response && error.response.status === 400) {
        return res.status(400).json(error.response.data);
      }
      log.error("Error in /admin/products create endpoint:", error.message);
      return next(error);
    }
  });

  service.put("/admin/products/:productId", async (req, res, next) => {
    try {
      const { productId } = req.params;
      const adminId = req.headers['x-admin-id'];
      
      if (!adminId) {
        return res.status(401).json({
          success: false,
          error: 'Admin authentication required'
        });
      }

      // Check permission
      const userService = await getNextService("user-service");
      const userServiceUrl = `http://${userService.ip}:${userService.port}`;
      const permissionCheck = await axios.post(`${userServiceUrl}/check-permission`, {
        identifier: adminId,
        permission: 'product_edit'
      });

      if (!permissionCheck.data.hasPermission) {
        return res.status(403).json({
          success: false,
          error: 'Admin does not have product edit permission'
        });
      }

      // Update product
      const productService = await getNextService("product-service");
      const productServiceUrl = `http://${productService.ip}:${productService.port}`;
      const response = await axios.put(`${productServiceUrl}/admin/update/${productId}`, req.body, {
        headers: {
          'x-admin-id': adminId
        }
      });

      log.info(
        `Product ${productId} updated by admin ${adminId} via ${productServiceUrl} (v${productService.version})`
      );
      return res.json({
        source: "product-service",
        serviceVersion: productService.version,
        serviceEndpoint: `${productService.ip}:${productService.port}`,
        ...response.data,
      });
    } catch (error) {
      if (error.response && (error.response.status === 404 || error.response.status === 400)) {
        return res.status(error.response.status).json(error.response.data);
      }
      log.error(`Error in /admin/products/${req.params.productId} update endpoint:`, error.message);
      return next(error);
    }
  });

  service.delete("/admin/products/:productId", async (req, res, next) => {
    try {
      const { productId } = req.params;
      const adminId = req.headers['x-admin-id'];
      
      if (!adminId) {
        return res.status(401).json({
          success: false,
          error: 'Admin authentication required'
        });
      }

      // Check permission
      const userService = await getNextService("user-service");
      const userServiceUrl = `http://${userService.ip}:${userService.port}`;
      const permissionCheck = await axios.post(`${userServiceUrl}/check-permission`, {
        identifier: adminId,
        permission: 'product_delete'
      });

      if (!permissionCheck.data.hasPermission) {
        return res.status(403).json({
          success: false,
          error: 'Admin does not have product delete permission'
        });
      }

      // Delete product
      const productService = await getNextService("product-service");
      const productServiceUrl = `http://${productService.ip}:${productService.port}`;
      const response = await axios.delete(`${productServiceUrl}/admin/delete/${productId}`, {
        headers: {
          'x-admin-id': adminId
        }
      });

      log.info(
        `Product ${productId} deleted by admin ${adminId} via ${productServiceUrl} (v${productService.version})`
      );
      return res.json({
        source: "product-service",
        serviceVersion: productService.version,
        serviceEndpoint: `${productService.ip}:${productService.port}`,
        ...response.data,
      });
    } catch (error) {
      if (error.response && error.response.status === 404) {
        return res.status(404).json(error.response.data);
      }
      log.error(`Error in /admin/products/${req.params.productId} delete endpoint:`, error.message);
      return next(error);
    }
  });

  // Product service endpoints
  service.get("/products", async (req, res, next) => {
    try {
      const productService = await getNextService("product-service");
      const productServiceUrl = `http://${productService.ip}:${productService.port}`;
      const response = await axios.get(`${productServiceUrl}/products`);
      
      log.info(`Successfully retrieved products from ${productServiceUrl} (v${productService.version})`);
      return res.json({
        source: "product-service",
        serviceVersion: productService.version,
        serviceEndpoint: `${productService.ip}:${productService.port}`,
        data: response.data,
      });
    } catch (error) {
      log.error("Error in /products endpoint:", error.message);
      return next(error);
    }
  });

  service.get("/products/:productId", async (req, res, next) => {
    try {
      const { productId } = req.params;
      const productService = await getNextService("product-service");
      const productServiceUrl = `http://${productService.ip}:${productService.port}`;
      const response = await axios.get(`${productServiceUrl}/products/${productId}`);
      
      log.info(`Successfully retrieved product ${productId} from ${productServiceUrl} (v${productService.version})`);
      return res.json({
        source: "product-service",
        serviceVersion: productService.version,
        serviceEndpoint: `${productService.ip}:${productService.port}`,
        data: response.data,
      });
    } catch (error) {
      if (error.response && error.response.status === 404) {
        return res.status(404).json({ error: "Product not found" });
      }
      log.error(`Error in /products/${req.params.productId} endpoint:`, error.message);
      return next(error);
    }
  });

  service.post("/vote/:productId", async (req, res, next) => {
    try {
      const { productId } = req.params;
      const { userId } = req.body;
      
      // Validate that userId is provided
      if (!userId) {
        return res.status(400).json({ 
          success: false,
          error: "User ID is required for voting" 
        });
      }
      
      // Validate user exists and is active
      const userService = await getNextService("user-service");
      const userServiceUrl = `http://${userService.ip}:${userService.port}`;
      
      try {
        const userValidation = await axios.post(`${userServiceUrl}/validate`, {
          identifier: userId
        });
        
        if (!userValidation.data.valid) {
          return res.status(403).json({
            success: false,
            error: "Invalid or inactive user. Please register or contact administrator."
          });
        }
        
        log.info(`User ${userId} validated for voting on product ${productId}`);
      } catch (userError) {
        log.error(`User validation failed for ${userId}:`, userError.message);
        return res.status(403).json({
          success: false,
          error: "User validation failed. Please ensure you are registered."
        });
      }
      
      // If user is valid, proceed with vote
      const productService = await getNextService("product-service");
      const productServiceUrl = `http://${productService.ip}:${productService.port}`;
      const response = await axios.post(`${productServiceUrl}/vote/${productId}`, req.body);
      
      log.info(`Successfully recorded vote for product ${productId} by user ${userId} via ${productServiceUrl} (v${productService.version})`);
      return res.json({
        source: "product-service",
        serviceVersion: productService.version,
        serviceEndpoint: `${productService.ip}:${productService.port}`,
        data: response.data,
      });
    } catch (error) {
      if (error.response && error.response.status === 404) {
        return res.status(404).json({ error: "Product not found" });
      }
      log.error(`Error in /vote/${req.params.productId} endpoint:`, error.message);
      return next(error);
    }
  });

  service.get("/votes/:productId", async (req, res, next) => {
    try {
      const { productId } = req.params;
      const productService = await getNextService("product-service");
      const productServiceUrl = `http://${productService.ip}:${productService.port}`;
      const response = await axios.get(`${productServiceUrl}/votes/${productId}`);
      
      log.info(`Successfully retrieved votes for product ${productId} from ${productServiceUrl} (v${productService.version})`);
      return res.json({
        source: "product-service",
        serviceVersion: productService.version,
        serviceEndpoint: `${productService.ip}:${productService.port}`,
        data: response.data,
      });
    } catch (error) {
      log.error(`Error in /votes/${req.params.productId} endpoint:`, error.message);
      return next(error);
    }
  });

  service.get("/top-products", async (req, res, next) => {
    try {
      const productService = await getNextService("product-service");
      const productServiceUrl = `http://${productService.ip}:${productService.port}`;
      const response = await axios.get(`${productServiceUrl}/top-products`, {
        params: req.query
      });
      
      log.info(`Successfully retrieved top products from ${productServiceUrl} (v${productService.version})`);
      return res.json({
        source: "product-service",
        serviceVersion: productService.version,
        serviceEndpoint: `${productService.ip}:${productService.port}`,
        data: response.data,
      });
    } catch (error) {
      log.error("Error in /top-products endpoint:", error.message);
      return next(error);
    }
  });

  service.get("/vote-stats", async (req, res, next) => {
    try {
      const productService = await getNextService("product-service");
      const productServiceUrl = `http://${productService.ip}:${productService.port}`;
      const response = await axios.get(`${productServiceUrl}/vote-stats`);
      
      log.info(`Successfully retrieved vote stats from ${productServiceUrl} (v${productService.version})`);
      return res.json({
        source: "product-service",
        serviceVersion: productService.version,
        serviceEndpoint: `${productService.ip}:${productService.port}`,
        data: response.data,
      });
    } catch (error) {
      log.error("Error in /vote-stats endpoint:", error.message);
      return next(error);
    }
  });

  // Real-time vote count endpoint
  service.get("/votes-realtime/:productId", async (req, res, next) => {
    try {
      const { productId } = req.params;
      const productService = await getNextService("product-service");
      const productServiceUrl = `http://${productService.ip}:${productService.port}`;
      const response = await axios.get(`${productServiceUrl}/votes-realtime/${productId}`);
      
      log.info(`Successfully retrieved real-time votes for product ${productId} from ${productServiceUrl} (v${productService.version})`);
      return res.json({
        source: "product-service",
        serviceVersion: productService.version,
        serviceEndpoint: `${productService.ip}:${productService.port}`,
        data: response.data,
      });
    } catch (error) {
      log.error(`Error in /votes-realtime/${req.params.productId} endpoint:`, error.message);
      return next(error);
    }
  });

  // Health check endpoint
  service.get("/health", (req, res) => {
    res.json({
      status: "healthy",
      service: config.name,
      version: config.version,
      timestamp: new Date().toISOString(),
    });
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
