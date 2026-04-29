// Initialize OpenTelemetry tracing first
require('./tracing');

const express = require('express');
const path = require('path');
const axios = require('axios');
const { MongoClient } = require('mongodb');
const { createClient } = require('redis');
const pino = require('pino');
const session = require('express-session');
const { createTracingMiddleware, createCustomSpan } = require('./tracing');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration
const config = {
  mongodb: {
    url: process.env.MONGODB_URL || 'mongodb://root:example@localhost:27017',
    dbName: process.env.MONGODB_DB || 'productservice'
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    username: process.env.REDIS_USERNAME || 'default',
    password: process.env.REDIS_PASSWORD || 'votingpass123'
  },
  gateway: {
    url: process.env.GATEWAY_URL || 'http://localhost:8080'
  },
  registry: {
    url: process.env.REGISTRY_URL || 'http://localhost:4000'
  }
};

// Logger
const log = pino({
  name: 'frontend-service',
  level: process.env.LOG_LEVEL || 'info'
});

// Database connections
let mongoClient = null;
let db = null;
let redisClient = null;

// Connect to databases
async function connectDatabases() {
  try {
    // MongoDB with 4.17.2 compatible options (no deprecated options)
    log.info(`Attempting to connect to MongoDB at: ${config.mongodb.url}`);
    log.info(`Target database: ${config.mongodb.dbName}`);
    
    const mongoOptions = {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
      maxPoolSize: 10,
      socketTimeoutMS: 45000,
    };
    
    mongoClient = new MongoClient(config.mongodb.url, mongoOptions);
    await mongoClient.connect();
    
    // Test the connection
    await mongoClient.db('admin').command({ ping: 1 });
    log.info('MongoDB ping successful');
    
    db = mongoClient.db(config.mongodb.dbName);
    log.info('Connected to MongoDB for Frontend Service');

    // Redis
    redisClient = createClient({
      socket: {
        host: config.redis.host,
        port: config.redis.port
      },
      username: config.redis.username,
      password: config.redis.password
    });

    redisClient.on('error', (err) => {
      log.error('Redis Client Error:', err);
    });

    await redisClient.connect();
    log.info('Connected to Redis');

  } catch (error) {
    log.error('Database connection error:', error);
    throw error;
  }
}

// Set up EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(createTracingMiddleware());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'voting-system-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true in production with HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Routes
app.get('/', async (req, res) => {
  try {
    // Get products from gateway
    const productsResponse = await axios.get(`${config.gateway.url}/products`);
    const products = productsResponse.data.data;

    // Get vote statistics from MongoDB
    const votesCollection = db.collection('votes');
    const voteStats = await votesCollection.aggregate([
      {
        $group: {
          _id: '$productId',
          voteCount: { $sum: 1 },
          lastVote: { $max: '$timestamp' }
        }
      },
      {
        $sort: { voteCount: -1 }
      }
    ]).toArray();

    // Get pending votes from Redis
    const queueLength = await redisClient.lLen('vote_queue');
    const pendingVotes = await redisClient.lRange('vote_queue', 0, queueLength - 1);
    
    // Count pending votes per product
    const pendingStats = {};
    for (const voteStr of pendingVotes) {
      try {
        const vote = JSON.parse(voteStr);
        pendingStats[vote.productId] = (pendingStats[vote.productId] || 0) + 1;
      } catch (error) {
        // Skip invalid votes
      }
    }

    // Combine data
    const productsWithVotes = products.map(product => {
      const stats = voteStats.find(s => s._id === product.id) || { voteCount: 0 };
      const pending = pendingStats[product.id] || 0;
      
      return {
        ...product,
        voteCount: stats.voteCount,
        pendingVotes: pending,
        totalVotes: stats.voteCount + pending,
        lastVote: stats.lastVote
      };
    });

    // Sort by total votes
    productsWithVotes.sort((a, b) => b.totalVotes - a.totalVotes);

    res.render('index', {
      products: productsWithVotes,
      totalPending: queueLength,
      title: 'Product Voting System'
    });

  } catch (error) {
    log.error('Error loading homepage:', error);
    res.status(500).render('error', { 
      error: 'Failed to load products',
      message: error.message 
    });
  }
});

// Products API endpoint for admin panel
app.get('/products', async (req, res) => {
  try {
    // Get products from gateway
    const productsResponse = await axios.get(`${config.gateway.url}/products`);
    
    // Return the same structure as gateway
    res.json(productsResponse.data);
  } catch (error) {
    log.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load products'
    });
  }
});

// Individual product API endpoint
app.get('/products/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const productResponse = await axios.get(`${config.gateway.url}/products/${productId}`);
    
    res.json(productResponse.data);
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }
    
    log.error('Error fetching product:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load product'
    });
  }
});

// Vote endpoint
app.post('/vote/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const { userId } = req.body;

    // Submit vote through gateway
    const response = await axios.post(`${config.gateway.url}/vote/${productId}`, {
      userId: userId || `anonymous_${Date.now()}`
    });

    log.info(`Vote submitted for product ${productId}`);
    res.json({ success: true, message: 'Vote submitted successfully!' });

  } catch (error) {
    log.error('Error submitting vote:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to submit vote' 
    });
  }
});

// API endpoint for real-time stats
app.get('/api/stats', async (req, res) => {
  try {
    const votesCollection = db.collection('votes');
    const totalVotes = await votesCollection.countDocuments();
    const queueLength = await redisClient.lLen('vote_queue');

    res.json({
      totalVotes,
      pendingVotes: queueLength,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    log.error('Error getting stats:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// API endpoint for authentication status
app.get('/api/auth-status', (req, res) => {
  if (req.session && req.session.user) {
    res.json({
      authenticated: true,
      user: req.session.user
    });
  } else {
    res.json({
      authenticated: false
    });
  }
});

// Users page
app.get('/users', async (req, res) => {
  try {
    log.info('Fetching users from gateway service...');
    
    // Try to get users from the gateway service (which discovers user service dynamically)
    let users = [];
    let userServiceError = null;
    
    try {
      const usersResponse = await axios.get(`${config.gateway.url}/user-list`, {
        timeout: 5000
      });
      users = usersResponse.data.data || [];
      log.info(`Retrieved ${users.length} users from gateway service`);
    } catch (error) {
      log.warn('Failed to fetch from gateway service, trying direct MongoDB connection:', error.message);
      userServiceError = error.message;
      
      // Fallback: Try to get users directly from MongoDB
      try {
        const userDb = mongoClient.db('userservice');
        const usersCollection = userDb.collection('users');
        users = await usersCollection.find({}, {
          projection: { name: 1, shortname: 1, title: 1, email: 1, department: 1, location: 1, isActive: 1, _id: 0 }
        }).toArray();
        log.info(`Retrieved ${users.length} users from MongoDB directly`);
      } catch (dbError) {
        log.error('Failed to fetch users from MongoDB:', dbError.message);
        users = [];
      }
    }

    // Get user voting statistics
    const votesCollection = db.collection('votes');
    const userVoteStats = await votesCollection.aggregate([
      {
        $group: {
          _id: '$userId',
          voteCount: { $sum: 1 },
          lastVote: { $max: '$timestamp' },
          productsVoted: { $addToSet: '$productId' }
        }
      },
      {
        $addFields: {
          uniqueProductsVoted: { $size: '$productsVoted' }
        }
      },
      {
        $sort: { voteCount: -1 }
      }
    ]).toArray();

    // Combine user data with voting stats
    const usersWithStats = users.map(user => {
      const stats = userVoteStats.find(s => s._id === user.shortname || s._id === user.id) || { 
        voteCount: 0, 
        uniqueProductsVoted: 0,
        lastVote: null 
      };
      
      return {
        ...user,
        voteCount: stats.voteCount,
        uniqueProductsVoted: stats.uniqueProductsVoted,
        lastVote: stats.lastVote,
        isActive: user.isActive !== false // Default to true if not specified
      };
    });

    // Sort by vote count, then by name
    usersWithStats.sort((a, b) => {
      if (b.voteCount !== a.voteCount) {
        return b.voteCount - a.voteCount;
      }
      return (a.name || '').localeCompare(b.name || '');
    });

    res.render('users', {
      users: usersWithStats,
      totalUsers: users.length,
      activeUsers: usersWithStats.filter(u => u.isActive).length,
      totalVoters: userVoteStats.length,
      userServiceError,
      title: 'System Users'
    });

  } catch (error) {
    log.error('Error loading users page:', error);
    res.status(500).render('error', { 
      error: 'Failed to load users',
      message: error.message 
    });
  }
});

// User Registration Page
app.get('/register', (req, res) => {
  res.render('register', {
    title: 'User Registration'
  });
});

// User Registration Handler
app.post('/register', async (req, res) => {
  try {
    log.info('Processing user registration...');
    
    const registrationData = {
      name: req.body.name,
      email: req.body.email,
      shortname: req.body.shortname,
      title: req.body.title || 'User',
      department: req.body.department || 'General',
      location: req.body.location || 'Unknown',
      summary: req.body.summary || `${req.body.name} - System User`
    };

    // Register user through gateway service
    const response = await axios.post(`${config.gateway.url}/register`, registrationData, {
      timeout: 10000
    });

    if (response.data.success) {
      log.info(`User registered successfully: ${registrationData.name} (${registrationData.shortname})`);
      
      // Store user info in session for immediate use
      req.session = req.session || {};
      req.session.user = {
        shortname: registrationData.shortname,
        name: registrationData.name,
        email: registrationData.email
      };
      
      res.json({
        success: true,
        message: 'Registration successful! You can now vote on products.',
        user: response.data.data,
        redirectUrl: '/'
      });
    } else {
      throw new Error(response.data.error || 'Registration failed');
    }

  } catch (error) {
    log.error('User registration failed:', error.message);
    
    let errorMessage = 'Registration failed. Please try again.';
    if (error.response && error.response.data && error.response.data.error) {
      errorMessage = error.response.data.error;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    res.status(400).json({
      success: false,
      error: errorMessage
    });
  }
});

// User Login/Validation Handler
app.post('/login', async (req, res) => {
  try {
    const { identifier } = req.body;
    
    if (!identifier) {
      return res.status(400).json({
        success: false,
        error: 'Email or shortname is required'
      });
    }

    // Validate user through gateway service
    const response = await axios.post(`${config.gateway.url}/validate-user`, {
      identifier: identifier
    }, {
      timeout: 5000
    });

    if (response.data.valid) {
      // Store user info in session
      req.session = req.session || {};
      req.session.user = response.data.user;
      
      log.info(`User logged in: ${response.data.user.name} (${response.data.user.shortname})`);
      
      res.json({
        success: true,
        message: 'Login successful!',
        user: response.data.user
      });
    } else {
      res.status(401).json({
        success: false,
        error: 'Invalid user or account inactive. Please register or contact administrator.'
      });
    }

  } catch (error) {
    log.error('User login failed:', error.message);
    res.status(500).json({
      success: false,
      error: 'Login failed. Please try again.'
    });
  }
});

// User Logout Handler
app.post('/logout', (req, res) => {
  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        log.error('Logout error:', err);
        return res.status(500).json({
          success: false,
          error: 'Logout failed'
        });
      }
      
      res.json({
        success: true,
        message: 'Logged out successfully'
      });
    });
  } else {
    res.json({
      success: true,
      message: 'Already logged out'
    });
  }
});

// Admin Authentication and Management Routes
app.get('/admin', (req, res) => {
  res.render('admin', {
    title: 'Admin Panel'
  });
});

app.post('/admin/login', async (req, res) => {
  try {
    const { identifier } = req.body;
    
    if (!identifier) {
      return res.status(400).json({
        success: false,
        error: 'Email or shortname is required'
      });
    }

    // Validate admin through gateway service
    const response = await axios.post(`${config.gateway.url}/admin/login`, {
      identifier: identifier
    }, {
      timeout: 5000
    });

    if (response.data.valid) {
      // Store admin info in session
      req.session = req.session || {};
      req.session.admin = response.data.admin;
      
      log.info(`Admin logged in: ${response.data.admin.name} (${response.data.admin.shortname})`);
      
      res.json({
        success: true,
        message: 'Admin login successful!',
        admin: response.data.admin
      });
    } else {
      res.status(401).json({
        success: false,
        error: 'Invalid credentials or not an admin account.'
      });
    }

  } catch (error) {
    log.error('Admin login failed:', error.message);
    res.status(500).json({
      success: false,
      error: 'Admin login failed. Please try again.'
    });
  }
});

app.post('/admin/logout', (req, res) => {
  if (req.session && req.session.admin) {
    const adminName = req.session.admin.name;
    req.session.destroy((err) => {
      if (err) {
        log.error('Admin logout error:', err);
        return res.status(500).json({
          success: false,
          error: 'Logout failed'
        });
      }
      
      log.info(`Admin logged out: ${adminName}`);
      res.json({
        success: true,
        message: 'Admin logged out successfully'
      });
    });
  } else {
    res.json({
      success: true,
      message: 'Already logged out'
    });
  }
});

// Admin Product Management Routes
app.post('/admin/products', async (req, res) => {
  try {
    if (!req.session || !req.session.admin) {
      return res.status(401).json({
        success: false,
        error: 'Admin authentication required'
      });
    }

    const response = await axios.post(`${config.gateway.url}/admin/products`, req.body, {
      headers: {
        'x-admin-id': req.session.admin.shortname
      },
      timeout: 10000
    });

    log.info(`Product created by admin: ${req.session.admin.shortname}`);
    res.status(201).json(response.data);

  } catch (error) {
    log.error('Product creation failed:', error.message);
    
    if (error.response && error.response.data) {
      return res.status(error.response.status).json(error.response.data);
    }
    
    res.status(500).json({
      success: false,
      error: 'Product creation failed. Please try again.'
    });
  }
});

app.put('/admin/products/:productId', async (req, res) => {
  try {
    if (!req.session || !req.session.admin) {
      return res.status(401).json({
        success: false,
        error: 'Admin authentication required'
      });
    }

    const { productId } = req.params;
    const response = await axios.put(`${config.gateway.url}/admin/products/${productId}`, req.body, {
      headers: {
        'x-admin-id': req.session.admin.shortname
      },
      timeout: 10000
    });

    log.info(`Product ${productId} updated by admin: ${req.session.admin.shortname}`);
    res.json(response.data);

  } catch (error) {
    log.error('Product update failed:', error.message);
    
    if (error.response && error.response.data) {
      return res.status(error.response.status).json(error.response.data);
    }
    
    res.status(500).json({
      success: false,
      error: 'Product update failed. Please try again.'
    });
  }
});

app.delete('/admin/products/:productId', async (req, res) => {
  try {
    if (!req.session || !req.session.admin) {
      return res.status(401).json({
        success: false,
        error: 'Admin authentication required'
      });
    }

    const { productId } = req.params;
    const response = await axios.delete(`${config.gateway.url}/admin/products/${productId}`, {
      headers: {
        'x-admin-id': req.session.admin.shortname
      },
      timeout: 10000
    });

    log.info(`Product ${productId} deleted by admin: ${req.session.admin.shortname}`);
    res.json(response.data);

  } catch (error) {
    log.error('Product deletion failed:', error.message);
    
    if (error.response && error.response.data) {
      return res.status(error.response.status).json(error.response.data);
    }
    
    res.status(500).json({
      success: false,
      error: 'Product deletion failed. Please try again.'
    });
  }
});

// Admin authentication status endpoint
app.get('/api/admin-status', (req, res) => {
  if (req.session && req.session.admin) {
    res.json({
      authenticated: true,
      admin: req.session.admin
    });
  } else {
    res.json({
      authenticated: false
    });
  }
});

// API endpoint for user data
app.get('/api/users', async (req, res) => {
  try {
    const usersResponse = await axios.get(`${config.gateway.url}/user-list`, {
      timeout: 5000
    });
    const users = usersResponse.data.data || [];
    
    res.json({
      success: true,
      data: users,
      count: users.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    log.error('Error fetching users via API:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch users',
      message: error.message 
    });
  }
});

// API endpoint for user details
app.get('/api/users/:shortname', async (req, res) => {
  try {
    const { shortname } = req.params;
    
    // Get user details from gateway service
    const userResponse = await axios.get(`${config.gateway.url}/user/${shortname}`, {
      timeout: 5000
    });
    const user = userResponse.data.data || userResponse.data;

    // Initialize default values
    let userVotes = [];
    let voteStats = [];
    let totalVotes = 0;
    let uniqueProducts = 0;

    // Try to get user's voting history from MongoDB
    try {
      if (db) {
        const votesCollection = db.collection('votes');
        
        // Check if votes collection exists and has data
        const voteCount = await votesCollection.countDocuments();
        log.debug(`Total votes in database: ${voteCount}`);
        
        if (voteCount > 0) {
          // Get user's voting history
          userVotes = await votesCollection.find({ userId: shortname })
            .sort({ timestamp: -1 })
            .limit(50)
            .toArray();

          // Get user's voting statistics
          voteStats = await votesCollection.aggregate([
            { $match: { userId: shortname } },
            {
              $group: {
                _id: '$productId',
                voteCount: { $sum: 1 },
                lastVote: { $max: '$timestamp' }
              }
            },
            { $sort: { voteCount: -1 } }
          ]).toArray();

          totalVotes = userVotes.length;
          uniqueProducts = voteStats.length;
        }
      } else {
        log.warn('Database connection not available for vote queries');
      }
    } catch (voteError) {
      log.warn(`Error fetching vote data for user ${shortname}:`, voteError.message);
      // Continue with empty vote data rather than failing
    }

    res.json({
      success: true,
      data: {
        user,
        recentVotes: userVotes,
        voteStats,
        totalVotes,
        uniqueProducts
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    log.error(`Error fetching user ${req.params.shortname}:`, error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch user details',
      message: error.message 
    });
  }
});

// Error handling
app.use((error, req, res, next) => {
  log.error('Application error:', error);
  res.status(500).render('error', {
    error: 'Internal Server Error',
    message: error.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).render('error', {
    error: '404 - Page Not Found',
    message: 'The requested page could not be found.'
  });
});

// Graceful shutdown
async function shutdown() {
  log.info('Shutting down frontend service...');
  
  if (mongoClient) {
    await mongoClient.close();
  }
  
  if (redisClient) {
    await redisClient.disconnect();
  }
  
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start server
async function start() {
  try {
    await connectDatabases();
    
    app.listen(PORT, () => {
      log.info(`Frontend service running on port ${PORT}`);
      log.info(`Visit http://localhost:${PORT} to view the voting interface`);
    });
    
  } catch (error) {
    log.error('Failed to start frontend service:', error);
    process.exit(1);
  }
}

start();