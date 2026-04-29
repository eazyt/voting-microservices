const { MongoClient } = require('mongodb');

// MongoDB configuration
const mongoUrl = 'mongodb://root:example@localhost:27017';
const dbName = 'userservice';
const collectionName = 'users';

async function resetAdminUser() {
  console.log('🔄 Resetting Admin User in MongoDB...\n');

  let client;
  try {
    // Connect to MongoDB
    console.log('1. Connecting to MongoDB...');
    client = new MongoClient(mongoUrl, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
    });
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    // Check current users
    console.log('\n2. Checking current users...');
    const currentUsers = await collection.find({}).toArray();
    console.log(`Found ${currentUsers.length} existing users:`);
    currentUsers.forEach(user => {
      console.log(`   - ${user.name} (${user.shortname}) - Role: ${user.role || 'user'}`);
    });

    // Check if admin already exists
    const existingAdmin = await collection.findOne({ shortname: 'admin' });
    
    if (existingAdmin) {
      console.log('\n3. Admin user already exists, updating...');
      
      // Update existing admin user with proper permissions
      const updateResult = await collection.updateOne(
        { shortname: 'admin' },
        {
          $set: {
            name: 'System Administrator',
            email: 'admin@votingsystem.com',
            role: 'admin',
            permissions: ['product_create', 'product_edit', 'product_delete', 'user_management', 'system_admin'],
            isDefaultAdmin: true,
            updatedAt: new Date()
          }
        }
      );
      
      if (updateResult.modifiedCount > 0) {
        console.log('✅ Admin user updated successfully');
      } else {
        console.log('ℹ️  Admin user was already up to date');
      }
    } else {
      console.log('\n3. Creating new admin user...');
      
      // Create new admin user
      const adminUser = {
        id: 'admin_001',
        name: 'System Administrator',
        email: 'admin@votingsystem.com',
        shortname: 'admin',
        title: 'System Administrator',
        summary: 'Default system administrator with full product management access',
        description: 'This is the default administrator account with capabilities to add, edit, and delete products in the voting system.',
        department: 'Administration',
        location: 'System',
        joinDate: new Date().toISOString().split('T')[0],
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
        role: 'admin',
        permissions: ['product_create', 'product_edit', 'product_delete', 'user_management', 'system_admin'],
        isDefaultAdmin: true
      };

      const insertResult = await collection.insertOne(adminUser);
      
      if (insertResult.insertedId) {
        console.log('✅ Admin user created successfully');
      } else {
        console.log('❌ Failed to create admin user');
      }
    }

    // Verify admin user
    console.log('\n4. Verifying admin user...');
    const verifyAdmin = await collection.findOne({ shortname: 'admin' });
    
    if (verifyAdmin && verifyAdmin.role === 'admin') {
      console.log('✅ Admin user verification successful');
      console.log(`   Name: ${verifyAdmin.name}`);
      console.log(`   Email: ${verifyAdmin.email}`);
      console.log(`   Shortname: ${verifyAdmin.shortname}`);
      console.log(`   Role: ${verifyAdmin.role}`);
      console.log(`   Permissions: ${verifyAdmin.permissions.join(', ')}`);
    } else {
      console.log('❌ Admin user verification failed');
    }

    // Show final user count
    console.log('\n5. Final user count...');
    const finalCount = await collection.countDocuments();
    console.log(`Total users in database: ${finalCount}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (client) {
      await client.close();
      console.log('\n✅ MongoDB connection closed');
    }
  }
}

// Run the reset
if (require.main === module) {
  resetAdminUser().catch(console.error);
}

module.exports = { resetAdminUser };