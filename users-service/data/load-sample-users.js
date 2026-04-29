const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

// MongoDB configuration
const mongoUrl = 'mongodb://root:example@localhost:27017';
const dbName = 'userservice';
const collectionName = 'users';

async function forceLoadSampleUsers() {
  console.log('🔄 Force Loading sample-users.json...\n');

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

    // Clear existing users
    console.log('\n2. Clearing existing users...');
    const deleteResult = await collection.deleteMany({});
    console.log(`✅ Deleted ${deleteResult.deletedCount} existing users`);

    // Load sample-users.json
    console.log('\n3. Loading sample-users.json...');
    const sampleUsersPath = path.join(__dirname, './sample-users.json');
    
    if (!fs.existsSync(sampleUsersPath)) {
      throw new Error(`sample-users.json not found at: ${sampleUsersPath}`);
    }

    const jsonData = JSON.parse(fs.readFileSync(sampleUsersPath, 'utf8'));
    
    if (!jsonData.users || !Array.isArray(jsonData.users)) {
      throw new Error('Invalid sample-users.json format - missing users array');
    }

    // Process and insert users
    const processedUsers = jsonData.users.map(user => ({
      ...user,
      createdAt: user.createdAt ? new Date(user.createdAt) : new Date(),
      updatedAt: new Date(),
      isActive: user.isActive !== undefined ? user.isActive : true
    }));

    const insertResult = await collection.insertMany(processedUsers);
    console.log(`✅ Inserted ${insertResult.insertedCount} users from sample-users.json`);

    // Verify admin user
    console.log('\n4. Verifying admin user...');
    const adminUser = await collection.findOne({ shortname: 'admin' });
    
    if (adminUser && adminUser.role === 'admin') {
      console.log('✅ Admin user loaded successfully');
      console.log(`   Name: ${adminUser.name}`);
      console.log(`   Email: ${adminUser.email}`);
      console.log(`   Permissions: ${adminUser.permissions.join(', ')}`);
    } else {
      console.log('❌ Admin user not found in sample-users.json');
    }

    // Show all loaded users
    console.log('\n5. Loaded users:');
    const allUsers = await collection.find({}).toArray();
    allUsers.forEach(user => {
      console.log(`   - ${user.name} (${user.shortname}) - Role: ${user.role || 'user'}`);
    });

    console.log(`\n✅ Successfully loaded ${allUsers.length} users from sample-users.json`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (client) {
      await client.close();
      console.log('\n✅ MongoDB connection closed');
    }
  }
}

// Run the force load
if (require.main === module) {
  forceLoadSampleUsers().catch(console.error);
}

module.exports = { forceLoadSampleUsers };