// MongoDB initialization script for MongoDB 4.4
// This script runs when MongoDB container starts for the first time

print('Starting MongoDB initialization for microservices voting system...');

// Switch to admin database for user creation
db = db.getSiblingDB('admin');

// Create application user with read/write access to all databases
try {
  db.createUser({
    user: 'appuser',
    pwd: 'apppass123',
    roles: [
      { role: 'readWrite', db: 'userservice' },
      { role: 'readWrite', db: 'productservice' },
      { role: 'dbAdmin', db: 'userservice' },
      { role: 'dbAdmin', db: 'productservice' }
    ]
  });
  print('✓ Created application user: appuser');
} catch (error) {
  if (error.code === 11000) {
    print('⚠ Application user already exists, skipping creation');
  } else {
    print('✗ Error creating application user:', error.message);
  }
}

// Initialize userservice database
print('Initializing userservice database...');
db = db.getSiblingDB('userservice');

// Create users collection if it doesn't exist
try {
  db.createCollection('users');
  print('✓ Created users collection');
} catch (error) {
  print('⚠ Users collection may already exist:', error.message);
}

// Create indexes for users collection
try {
  db.users.createIndex({ 'email': 1 }, { unique: true });
  db.users.createIndex({ 'name': 1 });
  print('✓ Created indexes for users collection');
} catch (error) {
  print('⚠ Error creating user indexes:', error.message);
}

// Insert sample users if collection is empty
const userCount = db.users.countDocuments();
if (userCount === 0) {
  try {
    db.users.insertMany([
      {
        id: 'user_001',
        name: 'John Doe',
        email: 'john.doe@example.com',
        createdAt: new Date(),
        isActive: true
      },
      {
        id: 'user_002', 
        name: 'Jane Smith',
        email: 'jane.smith@example.com',
        createdAt: new Date(),
        isActive: true
      },
      {
        id: 'user_003',
        name: 'Bob Johnson',
        email: 'bob.johnson@example.com', 
        createdAt: new Date(),
        isActive: true
      },
      {
        id: 'user_004',
        name: 'Alice Brown',
        email: 'alice.brown@example.com',
        createdAt: new Date(),
        isActive: true
      },
      {
        id: 'user_005',
        name: 'Charlie Wilson',
        email: 'charlie.wilson@example.com',
        createdAt: new Date(),
        isActive: true
      }
    ]);
    print('✓ Inserted sample user data');
  } catch (error) {
    print('✗ Error inserting sample users:', error.message);
  }
} else {
  print('⚠ Users collection already contains data, skipping sample data insertion');
}

// Initialize productservice database
print('Initializing productservice database...');
db = db.getSiblingDB('productservice');

// Create products collection
try {
  db.createCollection('products');
  print('✓ Created products collection');
} catch (error) {
  print('⚠ Products collection may already exist:', error.message);
}

// Create votes collection
try {
  db.createCollection('votes');
  print('✓ Created votes collection');
} catch (error) {
  print('⚠ Votes collection may already exist:', error.message);
}

// Create indexes for better performance
try {
  // Product indexes
  db.products.createIndex({ 'id': 1 }, { unique: true });
  db.products.createIndex({ 'category': 1 });
  db.products.createIndex({ 'name': 1 });
  db.products.createIndex({ 'inStock': 1 });
  
  // Vote indexes
  db.votes.createIndex({ 'productId': 1 });
  db.votes.createIndex({ 'userId': 1 });
  db.votes.createIndex({ 'timestamp': 1 });
  db.votes.createIndex({ 'ip': 1 });
  
  // Compound indexes for common queries
  db.votes.createIndex({ 'productId': 1, 'timestamp': -1 });
  db.votes.createIndex({ 'userId': 1, 'productId': 1 });
  
  print('✓ Created database indexes for performance optimization');
} catch (error) {
  print('✗ Error creating indexes:', error.message);
}

// Insert sample products if collection is empty
const productCount = db.products.countDocuments();
if (productCount === 0) {
  try {
    db.products.insertMany([
      {
        id: 'prod_001',
        name: 'Wireless Headphones',
        category: 'Electronics',
        price: 99.99,
        description: 'High-quality wireless headphones with noise cancellation',
        inStock: true,
        stockCount: 50,
        createdAt: new Date()
      },
      {
        id: 'prod_002',
        name: 'Coffee Maker',
        category: 'Appliances',
        price: 149.99,
        description: 'Programmable coffee maker with thermal carafe',
        inStock: true,
        stockCount: 25,
        createdAt: new Date()
      },
      {
        id: 'prod_003',
        name: 'Running Shoes',
        category: 'Sports',
        price: 79.99,
        description: 'Comfortable running shoes with advanced cushioning',
        inStock: true,
        stockCount: 100,
        createdAt: new Date()
      },
      {
        id: 'prod_004',
        name: 'Desk Lamp',
        category: 'Furniture',
        price: 39.99,
        description: 'LED desk lamp with adjustable brightness',
        inStock: true,
        stockCount: 30,
        createdAt: new Date()
      },
      {
        id: 'prod_005',
        name: 'Smartphone Case',
        category: 'Accessories',
        price: 19.99,
        description: 'Protective smartphone case with wireless charging support',
        inStock: true,
        stockCount: 200,
        createdAt: new Date()
      },
      {
        id: 'prod_006',
        name: 'Bluetooth Speaker',
        category: 'Electronics',
        price: 59.99,
        description: 'Portable Bluetooth speaker with excellent sound quality',
        inStock: true,
        stockCount: 75,
        createdAt: new Date()
      },
      {
        id: 'prod_007',
        name: 'Gaming Mouse',
        category: 'Electronics',
        price: 49.99,
        description: 'High-precision gaming mouse with RGB lighting',
        inStock: true,
        stockCount: 40,
        createdAt: new Date()
      },
      {
        id: 'prod_008',
        name: 'Water Bottle',
        category: 'Sports',
        price: 24.99,
        description: 'Insulated stainless steel water bottle',
        inStock: true,
        stockCount: 150,
        createdAt: new Date()
      }
    ]);
    print('✓ Inserted sample product data');
  } catch (error) {
    print('✗ Error inserting sample products:', error.message);
  }
} else {
  print('⚠ Products collection already contains data, skipping sample data insertion');
}

// Insert some sample votes for demonstration
const voteCount = db.votes.countDocuments();
if (voteCount === 0) {
  try {
    const sampleVotes = [];
    const productIds = ['prod_001', 'prod_002', 'prod_003', 'prod_004', 'prod_005'];
    const userIds = ['user_001', 'user_002', 'user_003', 'user_004', 'user_005'];
    
    // Generate some random votes
    for (let i = 0; i < 25; i++) {
      sampleVotes.push({
        productId: productIds[Math.floor(Math.random() * productIds.length)],
        userId: userIds[Math.floor(Math.random() * userIds.length)],
        timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000), // Random time in last 7 days
        ip: `192.168.1.${Math.floor(Math.random() * 255)}`
      });
    }
    
    db.votes.insertMany(sampleVotes);
    print('✓ Inserted sample vote data');
  } catch (error) {
    print('✗ Error inserting sample votes:', error.message);
  }
} else {
  print('⚠ Votes collection already contains data, skipping sample data insertion');
}

// Create a view for vote statistics (MongoDB 4.4 supports views)
try {
  db.createView('vote_stats', 'votes', [
    {
      $group: {
        _id: '$productId',
        totalVotes: { $sum: 1 },
        uniqueUsers: { $addToSet: '$userId' },
        lastVote: { $max: '$timestamp' }
      }
    },
    {
      $addFields: {
        uniqueUserCount: { $size: '$uniqueUsers' }
      }
    },
    {
      $project: {
        productId: '$_id',
        totalVotes: 1,
        uniqueUserCount: 1,
        lastVote: 1,
        _id: 0
      }
    },
    {
      $sort: { totalVotes: -1 }
    }
  ]);
  print('✓ Created vote_stats view for analytics');
} catch (error) {
  print('⚠ Vote stats view may already exist:', error.message);
}

// Display final statistics
print('');
print('========================================');
print('MongoDB Initialization Complete!');
print('========================================');

db = db.getSiblingDB('userservice');
const finalUserCount = db.users.countDocuments();
print('Users in userservice database:', finalUserCount);

db = db.getSiblingDB('productservice');
const finalProductCount = db.products.countDocuments();
const finalVoteCount = db.votes.countDocuments();
print('Products in productservice database:', finalProductCount);
print('Votes in productservice database:', finalVoteCount);

print('');
print('Database setup completed successfully!');
print('Application users can now connect using:');
print('  Username: appuser');
print('  Password: apppass123');
print('  Databases: userservice, productservice');
print('');
print('Ready for microservices to connect and operate.');