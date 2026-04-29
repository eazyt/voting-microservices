const { MongoClient } = require('mongodb');
const { createClient } = require('redis');

class ProductService {
  constructor(mongoConfig, redisConfig) {
    this.mongoUrl = mongoConfig.mongoUrl || 'mongodb://localhost:27017';
    this.dbName = mongoConfig.dbName || 'productservice';
    this.productsCollection = 'products';
    this.votesCollection = 'votes';
    this.client = null;
    this.db = null;
    
    // Redis configuration
    this.redisConfig = redisConfig || {
      host: 'localhost',
      port: 6379,
      username: 'default',
      password: 'votingpass123'
    };
    this.redisClient = null;
  }

  async connect() {
    if (!this.client || !this.db) {
      try {
        console.log(`Attempting to connect to MongoDB at: ${this.mongoUrl}`);
        console.log(`Target database: ${this.dbName}`);
        
        // MongoDB 4.17.2 compatible connection options (no deprecated options)
        const options = {
          serverSelectionTimeoutMS: 5000, // 5 second timeout
          connectTimeoutMS: 10000, // 10 second timeout
          maxPoolSize: 10, // Maintain up to 10 socket connections
          socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
        };
        
        this.client = new MongoClient(this.mongoUrl, options);
        await this.client.connect();
        
        // Test the connection
        await this.client.db('admin').command({ ping: 1 });
        console.log('MongoDB ping successful');
        
        this.db = this.client.db(this.dbName);
        console.log('Connected to MongoDB for Product Service');
        
        return true; // Connection successful
        
      } catch (error) {
        console.error('MongoDB connection failed:', error.message);
        console.error('Error name:', error.name);
        console.error('Error code:', error.code);
        console.error('Connection details:', {
          url: this.mongoUrl,
          database: this.dbName,
          errorType: error.constructor.name
        });
        
        // Log more specific error information
        if (error.code === 'ECONNREFUSED') {
          console.error('MongoDB server is not running or not accessible');
        } else if (error.code === 'ENOTFOUND') {
          console.error('MongoDB host not found - check your connection string');
        } else if (error.name === 'MongoServerSelectionError') {
          console.error('Could not connect to any MongoDB servers - check if MongoDB is running');
        }
        
        // Clean up failed connection attempt
        this.client = null;
        this.db = null;
        
        throw error;
      }
    }
    return true; // Already connected
  }

  async connectRedis() {
    if (!this.redisClient) {
      this.redisClient = createClient({
        socket: {
          host: this.redisConfig.host,
          port: this.redisConfig.port
        },
        username: this.redisConfig.username,
        password: this.redisConfig.password
      });

      this.redisClient.on('error', (err) => {
        console.error('Redis Client Error:', err);
      });

      await this.redisClient.connect();
      console.log('Connected to Redis for vote queuing');
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
    }
    
    if (this.redisClient) {
      await this.redisClient.disconnect();
      this.redisClient = null;
    }
  }

  async initializeData() {
    try {
      console.log('Starting MongoDB initialization for Product Service...');
      await this.connect();
      
      const productsCollection = this.db.collection(this.productsCollection);
      console.log('Connected to products collection');
      
      // Check if products already exist
      const count = await productsCollection.countDocuments();
      console.log(`Found ${count} existing products in database`);
      
      if (count > 0) {
        console.log('Product data already exists in MongoDB');
        return;
      }

      console.log('Initializing sample product data...');
      
      // Initialize with sample products
      const sampleProducts = [
        {
          id: 'prod_001',
          name: 'Wireless Headphones',
          category: 'Electronics',
          price: 99.99,
          description: 'High-quality wireless headphones with noise cancellation',
          inStock: true,
          stockCount: 50
        },
        {
          id: 'prod_002',
          name: 'Coffee Maker',
          category: 'Appliances',
          price: 149.99,
          description: 'Programmable coffee maker with thermal carafe',
          inStock: true,
          stockCount: 25
        },
        {
          id: 'prod_003',
          name: 'Running Shoes',
          category: 'Sports',
          price: 79.99,
          description: 'Comfortable running shoes with advanced cushioning',
          inStock: true,
          stockCount: 100
        },
        {
          id: 'prod_004',
          name: 'Desk Lamp',
          category: 'Furniture',
          price: 39.99,
          description: 'LED desk lamp with adjustable brightness',
          inStock: true,
          stockCount: 30
        },
        {
          id: 'prod_005',
          name: 'Smartphone Case',
          category: 'Accessories',
          price: 19.99,
          description: 'Protective smartphone case with wireless charging support',
          inStock: true,
          stockCount: 200
        }
      ];

      const result = await productsCollection.insertMany(sampleProducts);
      console.log(`Sample product data loaded into MongoDB. Inserted ${result.insertedCount} products.`);
      
    } catch (error) {
      console.error('Detailed error in initializeData:', error);
      console.error('Error stack:', error.stack);
      console.error('MongoDB URL:', this.mongoUrl);
      console.error('Database name:', this.dbName);
      throw error; // Re-throw to be caught by the calling code
    }
  }

  async getAllProducts() {
    try {
      await this.connect();
      
      // Double-check that connection was successful
      if (!this.db) {
        throw new Error('Database connection not established - db is null');
      }
      
      if (!this.client) {
        throw new Error('Database connection not established - client is null');
      }
      
      console.log('Getting products from collection:', this.productsCollection);
      const collection = this.db.collection(this.productsCollection);
      const products = await collection.find({}).toArray();
      console.log(`Retrieved ${products.length} products from database`);
      return products;
      
    } catch (error) {
      console.error('Error in getAllProducts:', error.message);
      console.error('Database connection status:', {
        client: !!this.client,
        db: !!this.db,
        mongoUrl: this.mongoUrl,
        dbName: this.dbName
      });
      
      // Return empty array instead of throwing to prevent service crash
      console.log('Returning empty products array due to database error');
      return [];
    }
  }

  async getProduct(productId) {
    await this.connect();
    const collection = this.db.collection(this.productsCollection);
    return await collection.findOne({ id: productId });
  }

  async getProductsByCategory(category) {
    await this.connect();
    const collection = this.db.collection(this.productsCollection);
    return await collection.find({ category: category }).toArray();
  }

  async voteForProduct(productId, userId = null, userIp = null) {
    await this.connect();
    await this.connectRedis();
    
    // Check if product exists
    const product = await this.getProduct(productId);
    if (!product) {
      throw new Error('Product not found');
    }

    // Create vote object for Redis queue
    const vote = {
      productId: productId,
      userId: userId,
      timestamp: new Date().toISOString(),
      ip: userIp
    };

    // Queue the vote in Redis instead of directly writing to MongoDB
    await this.redisClient.lPush('vote_queue', JSON.stringify(vote));
    
    console.log(`Vote queued in Redis for product ${productId}`);
    return { success: true, message: 'Vote queued successfully' };
  }

  // Method to get real-time vote count from Redis (for immediate feedback)
  async getRedisVoteCount(productId) {
    await this.connectRedis();
    
    // Get all votes from Redis queue and count for this product
    const queueLength = await this.redisClient.lLen('vote_queue');
    const votes = await this.redisClient.lRange('vote_queue', 0, queueLength - 1);
    
    let count = 0;
    for (const voteStr of votes) {
      try {
        const vote = JSON.parse(voteStr);
        if (vote.productId === productId) {
          count++;
        }
      } catch (error) {
        console.error('Error parsing vote from Redis:', error);
      }
    }
    
    return count;
  }

  async getProductVotes(productId) {
    await this.connect();
    const votesCollection = this.db.collection(this.votesCollection);
    
    const voteCount = await votesCollection.countDocuments({ productId: productId });
    const votes = await votesCollection.find({ productId: productId }).toArray();
    
    return {
      productId: productId,
      totalVotes: voteCount,
      votes: votes
    };
  }

  async getTopProducts(limit = 10) {
    await this.connect();
    const votesCollection = this.db.collection(this.votesCollection);
    
    // Aggregate votes by product
    const topProducts = await votesCollection.aggregate([
      {
        $group: {
          _id: '$productId',
          voteCount: { $sum: 1 }
        }
      },
      {
        $sort: { voteCount: -1 }
      },
      {
        $limit: limit
      }
    ]).toArray();

    // Get product details for top products
    const productsCollection = this.db.collection(this.productsCollection);
    const results = [];
    
    for (const item of topProducts) {
      const product = await productsCollection.findOne({ id: item._id });
      if (product) {
        results.push({
          ...product,
          voteCount: item.voteCount
        });
      }
    }

    return results;
  }

  async getAllVoteStats() {
    await this.connect();
    const votesCollection = this.db.collection(this.votesCollection);
    
    const stats = await votesCollection.aggregate([
      {
        $group: {
          _id: '$productId',
          voteCount: { $sum: 1 }
        }
      },
      {
        $sort: { voteCount: -1 }
      }
    ]).toArray();

    return stats;
  }

  // Admin-only product management methods
  async createProduct(productData, adminId) {
    await this.connect();
    const collection = this.db.collection(this.productsCollection);
    
    // Validate required fields
    if (!productData.name || !productData.price || !productData.category) {
      throw new Error('Missing required fields: name, price, and category are required');
    }
    
    // Generate unique product ID
    const productId = `product_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Check if product with same name already exists
    const existingProduct = await collection.findOne({ name: productData.name });
    if (existingProduct) {
      throw new Error('Product with this name already exists');
    }
    
    // Create new product document
    const newProduct = {
      id: productId,
      name: productData.name,
      description: productData.description || '',
      price: parseFloat(productData.price),
      category: productData.category,
      imageUrl: productData.imageUrl || '',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: adminId
    };
    
    // Insert the new product
    const result = await collection.insertOne(newProduct);
    
    // Return the created product (without MongoDB _id)
    const createdProduct = await collection.findOne(
      { _id: result.insertedId },
      { projection: { _id: 0 } }
    );
    
    console.log(`New product created: ${newProduct.name} by admin ${adminId}`);
    return createdProduct;
  }

  async updateProduct(productId, updateData, adminId) {
    await this.connect();
    const collection = this.db.collection(this.productsCollection);
    
    // Remove fields that shouldn't be updated directly
    const { _id, id, createdAt, createdBy, ...allowedUpdates } = updateData;
    
    // Add updatedAt timestamp and admin info
    allowedUpdates.updatedAt = new Date();
    allowedUpdates.updatedBy = adminId;
    
    // If name is being updated, check for duplicates
    if (allowedUpdates.name) {
      const existingProduct = await collection.findOne({ 
        name: allowedUpdates.name,
        id: { $ne: productId } // Exclude current product
      });
      if (existingProduct) {
        throw new Error('Product with this name already exists');
      }
    }
    
    // Convert price to number if provided
    if (allowedUpdates.price) {
      allowedUpdates.price = parseFloat(allowedUpdates.price);
    }
    
    const result = await collection.updateOne(
      { id: productId },
      { $set: allowedUpdates }
    );
    
    if (result.matchedCount === 0) {
      throw new Error('Product not found');
    }
    
    // Return updated product
    const updatedProduct = await collection.findOne(
      { id: productId },
      { projection: { _id: 0 } }
    );
    
    console.log(`Product ${productId} updated by admin ${adminId}`);
    return updatedProduct;
  }

  async deleteProduct(productId, adminId) {
    await this.connect();
    const collection = this.db.collection(this.productsCollection);
    const votesCollection = this.db.collection(this.votesCollection);
    
    // Check if product exists
    const product = await collection.findOne({ id: productId });
    if (!product) {
      throw new Error('Product not found');
    }
    
    // Check if product has votes
    const voteCount = await votesCollection.countDocuments({ productId: productId });
    
    if (voteCount > 0) {
      // Soft delete - mark as inactive instead of hard delete to preserve vote history
      const result = await collection.updateOne(
        { id: productId },
        { 
          $set: { 
            isActive: false, 
            deletedAt: new Date(),
            deletedBy: adminId
          } 
        }
      );
      
      console.log(`Product ${productId} soft deleted by admin ${adminId} (had ${voteCount} votes)`);
      return { 
        success: true, 
        message: 'Product deactivated successfully (votes preserved)',
        voteCount: voteCount,
        softDelete: true
      };
    } else {
      // Hard delete if no votes
      const result = await collection.deleteOne({ id: productId });
      
      console.log(`Product ${productId} hard deleted by admin ${adminId} (no votes)`);
      return { 
        success: true, 
        message: 'Product deleted successfully',
        voteCount: 0,
        softDelete: false
      };
    }
  }

  async restoreProduct(productId, adminId) {
    await this.connect();
    const collection = this.db.collection(this.productsCollection);
    
    const result = await collection.updateOne(
      { id: productId, isActive: false },
      { 
        $set: { 
          isActive: true, 
          restoredAt: new Date(),
          restoredBy: adminId
        },
        $unset: {
          deletedAt: "",
          deletedBy: ""
        }
      }
    );
    
    if (result.matchedCount === 0) {
      throw new Error('Product not found or already active');
    }
    
    console.log(`Product ${productId} restored by admin ${adminId}`);
    return { success: true, message: 'Product restored successfully' };
  }

  async getProductStats(productId) {
    await this.connect();
    const collection = this.db.collection(this.productsCollection);
    const votesCollection = this.db.collection(this.votesCollection);
    
    const product = await collection.findOne({ id: productId }, { projection: { _id: 0 } });
    if (!product) {
      throw new Error('Product not found');
    }
    
    // Get vote statistics
    const voteCount = await votesCollection.countDocuments({ productId: productId });
    const recentVotes = await votesCollection.find({ productId: productId })
      .sort({ timestamp: -1 })
      .limit(10)
      .toArray();
    
    // Get unique voters
    const uniqueVoters = await votesCollection.distinct('userId', { productId: productId });
    
    return {
      product,
      voteCount,
      uniqueVoters: uniqueVoters.length,
      recentVotes,
      createdAt: product.createdAt,
      isActive: product.isActive
    };
  }
}

module.exports = ProductService;