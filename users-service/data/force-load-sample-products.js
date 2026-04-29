const { MongoClient } = require('mongodb');

async function loadSampleProducts() {
  const mongoUrl = 'mongodb://root:example@localhost:27017';
  const dbName = 'productservice';
  
  let client;
  
  try {
    console.log('🔗 Connecting to MongoDB...');
    client = new MongoClient(mongoUrl);
    await client.connect();
    
    // Test the connection
    await client.db('admin').command({ ping: 1 });
    console.log('✅ MongoDB connection successful');
    
    const db = client.db(dbName);
    const productsCollection = db.collection('products');
    
    // Check existing products
    const existingCount = await productsCollection.countDocuments();
    console.log(`📊 Found ${existingCount} existing products`);
    
    if (existingCount > 0) {
      console.log('🗑️  Clearing existing products...');
      await productsCollection.deleteMany({});
    }
    
    console.log('📦 Loading sample products...');
    
    const sampleProducts = [
      {
        id: 'prod_001',
        name: 'Wireless Headphones',
        category: 'Electronics',
        price: 99.99,
        description: 'High-quality wireless headphones with noise cancellation',
        inStock: true,
        stockCount: 50,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'prod_002',
        name: 'Coffee Maker',
        category: 'Appliances',
        price: 149.99,
        description: 'Programmable coffee maker with thermal carafe',
        inStock: true,
        stockCount: 25,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'prod_003',
        name: 'Running Shoes',
        category: 'Sports',
        price: 79.99,
        description: 'Comfortable running shoes with advanced cushioning',
        inStock: true,
        stockCount: 100,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'prod_004',
        name: 'Desk Lamp',
        category: 'Furniture',
        price: 39.99,
        description: 'LED desk lamp with adjustable brightness',
        inStock: true,
        stockCount: 30,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'prod_005',
        name: 'Smartphone Case',
        category: 'Accessories',
        price: 19.99,
        description: 'Protective smartphone case with wireless charging support',
        inStock: true,
        stockCount: 200,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'prod_006',
        name: 'Gaming Mouse',
        category: 'Electronics',
        price: 59.99,
        description: 'High-precision gaming mouse with RGB lighting',
        inStock: true,
        stockCount: 75,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'prod_007',
        name: 'Yoga Mat',
        category: 'Sports',
        price: 29.99,
        description: 'Non-slip yoga mat with carrying strap',
        inStock: true,
        stockCount: 150,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'prod_008',
        name: 'Bluetooth Speaker',
        category: 'Electronics',
        price: 89.99,
        description: 'Portable Bluetooth speaker with 360-degree sound',
        inStock: true,
        stockCount: 60,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
    
    const result = await productsCollection.insertMany(sampleProducts);
    console.log(`✅ Successfully loaded ${result.insertedCount} products into MongoDB`);
    
    // Verify the data
    const finalCount = await productsCollection.countDocuments();
    console.log(`📊 Total products in database: ${finalCount}`);
    
    // Show sample products
    const products = await productsCollection.find({}).limit(3).toArray();
    console.log('\n📋 Sample products:');
    products.forEach(product => {
      console.log(`  - ${product.name} (${product.id}) - $${product.price}`);
    });
    
  } catch (error) {
    console.error('❌ Error loading sample products:', error.message);
    console.error('Full error:', error);
  } finally {
    if (client) {
      await client.close();
      console.log('🔌 MongoDB connection closed');
    }
  }
}

// Run the script
loadSampleProducts().then(() => {
  console.log('🎉 Sample product loading completed!');
  process.exit(0);
}).catch(error => {
  console.error('💥 Script failed:', error);
  process.exit(1);
});