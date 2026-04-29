const { MongoClient } = require('mongodb');
const { createClient } = require('redis');

// Configuration
const MONGODB_URL = process.env.MONGODB_URL || 'mongodb://root:example@localhost:27017';
const MONGODB_DB = process.env.MONGODB_DB || 'productservice';
const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  username: process.env.REDIS_USERNAME || 'default',
  password: process.env.REDIS_PASSWORD || 'votingpass123'
};

async function resetVotes() {
  console.log('🔄 Resetting All Votes...\n');

  let mongoClient = null;
  let redisClient = null;

  try {
    // Connect to MongoDB
    console.log('1. Connecting to MongoDB...');
    mongoClient = new MongoClient(MONGODB_URL, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000
    });
    
    await mongoClient.connect();
    await mongoClient.db('admin').command({ ping: 1 });
    console.log('✅ Connected to MongoDB');

    const db = mongoClient.db(MONGODB_DB);
    const votesCollection = db.collection('votes');

    // Get current vote count
    const currentVoteCount = await votesCollection.countDocuments();
    console.log(`   Current votes in MongoDB: ${currentVoteCount}`);

    // Clear MongoDB votes
    if (currentVoteCount > 0) {
      console.log('\n2. Clearing MongoDB votes...');
      const deleteResult = await votesCollection.deleteMany({});
      console.log(`✅ Deleted ${deleteResult.deletedCount} votes from MongoDB`);
    } else {
      console.log('\n2. No votes found in MongoDB to clear');
    }

    // Connect to Redis
    console.log('\n3. Connecting to Redis...');
    redisClient = createClient({
      socket: {
        host: REDIS_CONFIG.host,
        port: REDIS_CONFIG.port
      },
      username: REDIS_CONFIG.username,
      password: REDIS_CONFIG.password
    });

    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    await redisClient.connect();
    console.log('✅ Connected to Redis');

    // Check Redis vote queue
    const queueLength = await redisClient.lLen('vote_queue');
    console.log(`   Current votes in Redis queue: ${queueLength}`);

    // Clear Redis vote queue
    if (queueLength > 0) {
      console.log('\n4. Clearing Redis vote queue...');
      await redisClient.del('vote_queue');
      console.log(`✅ Cleared ${queueLength} votes from Redis queue`);
    } else {
      console.log('\n4. No votes found in Redis queue to clear');
    }

    // Verify cleanup
    console.log('\n5. Verifying cleanup...');
    const finalMongoCount = await votesCollection.countDocuments();
    const finalRedisCount = await redisClient.lLen('vote_queue');
    
    console.log(`   MongoDB votes remaining: ${finalMongoCount}`);
    console.log(`   Redis queue votes remaining: ${finalRedisCount}`);

    if (finalMongoCount === 0 && finalRedisCount === 0) {
      console.log('\n🎉 All votes successfully reset!');
      console.log('\nWhat was reset:');
      console.log('• All vote records from MongoDB');
      console.log('• All pending votes from Redis queue');
      console.log('• Vote statistics will now show 0 for all products');
    } else {
      console.log('\n⚠️  Some votes may still remain - check the counts above');
    }

  } catch (error) {
    console.error('\n❌ Error resetting votes:', error.message);
    
    if (error.message.includes('Authentication failed')) {
      console.error('💡 Check your MongoDB credentials');
    } else if (error.message.includes('ECONNREFUSED')) {
      console.error('💡 Make sure MongoDB and Redis containers are running');
      console.error('   Run: docker-compose up -d');
    }
    
    process.exit(1);
  } finally {
    // Clean up connections
    if (mongoClient) {
      await mongoClient.close();
      console.log('\n🔌 Disconnected from MongoDB');
    }
    
    if (redisClient) {
      await redisClient.disconnect();
      console.log('🔌 Disconnected from Redis');
    }
  }
}

// Add confirmation prompt
async function confirmReset() {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question('⚠️  This will permanently delete ALL votes. Are you sure? (yes/no): ', (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

// Main execution
async function main() {
  console.log('🗳️  Vote Reset Utility');
  console.log('====================\n');
  
  const confirmed = await confirmReset();
  
  if (!confirmed) {
    console.log('❌ Vote reset cancelled');
    process.exit(0);
  }
  
  await resetVotes();
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { resetVotes };