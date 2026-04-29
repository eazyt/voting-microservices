// Initialize OpenTelemetry tracing first
require('./tracing');

const { MongoClient } = require('mongodb');
const { createClient } = require('redis');
const pino = require('pino');
const { createCustomSpan } = require('./tracing');

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
  worker: {
    batchSize: parseInt(process.env.BATCH_SIZE) || 10,
    pollInterval: parseInt(process.env.POLL_INTERVAL) || 1000, // 1 second
    maxRetries: parseInt(process.env.MAX_RETRIES) || 3
  }
};

// Logger setup
const log = pino({
  name: 'vote-worker',
  level: process.env.LOG_LEVEL || 'info',
  // transport: process.env.NODE_ENV === 'development'
  //   ? {
  //       target: 'pino-pretty',
  //       options: { colorize: true }
  //     }
  //   : undefined
});

class VoteWorker {
  constructor() {
    this.mongoClient = null;
    this.db = null;
    this.redisClient = null;
    this.isRunning = false;
    this.processedCount = 0;
    this.errorCount = 0;
  }

  async connect() {
    try {
      // Connect to MongoDB with 4.4 compatible options
      log.info(`Attempting to connect to MongoDB at: ${config.mongodb.url}`);
      log.info(`Target database: ${config.mongodb.dbName}`);
      
      const mongoOptions = {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 10000,
        maxPoolSize: 10,
        socketTimeoutMS: 45000,
      };
      
      this.mongoClient = new MongoClient(config.mongodb.url, mongoOptions);
      await this.mongoClient.connect();
      
      // Test the connection
      await this.mongoClient.db('admin').command({ ping: 1 });
      log.info('MongoDB ping successful');
      
      this.db = this.mongoClient.db(config.mongodb.dbName);
      log.info('Connected to MongoDB for Worker Service');

      // Connect to Redis
      this.redisClient = createClient({
        socket: {
          host: config.redis.host,
          port: config.redis.port
        },
        username: config.redis.username,
        password: config.redis.password
      });

      this.redisClient.on('error', (err) => {
        log.error('Redis Client Error:', err);
      });

      await this.redisClient.connect();
      log.info('Connected to Redis');

    } catch (error) {
      log.error('Connection error:', error.message);
      log.error('Error details:', {
        mongoUrl: config.mongodb.url,
        database: config.mongodb.dbName,
        errorType: error.constructor.name,
        errorCode: error.code
      });
      throw error;
    }
  }

  async disconnect() {
    this.isRunning = false;
    
    if (this.mongoClient) {
      await this.mongoClient.close();
      log.info('Disconnected from MongoDB');
    }
    
    if (this.redisClient) {
      await this.redisClient.disconnect();
      log.info('Disconnected from Redis');
    }
  }

  async processVoteBatch() {
    return await createCustomSpan('worker.processVoteBatch', async (span) => {
      try {
        const votes = [];
        
        // Get batch of votes from Redis queue
        for (let i = 0; i < config.worker.batchSize; i++) {
          const voteStr = await this.redisClient.rPop('vote_queue');
          if (!voteStr) break;
          
          try {
            const vote = JSON.parse(voteStr);
            vote.timestamp = new Date(vote.timestamp);
            vote.processedAt = new Date();
            votes.push(vote);
          } catch (parseError) {
            log.error('Error parsing vote:', parseError, { voteStr });
            this.errorCount++;
            span.recordException(parseError);
          }
        }

        span.setAttributes({
          'worker.batch_size': config.worker.batchSize,
          'worker.votes_retrieved': votes.length,
          'worker.total_processed': this.processedCount,
          'worker.error_count': this.errorCount
        });

        if (votes.length === 0) {
          return 0;
        }

        // Insert votes into MongoDB
        const votesCollection = this.db.collection('votes');
        const result = await votesCollection.insertMany(votes);
        
        this.processedCount += result.insertedCount;
        
        span.setAttributes({
          'worker.votes_inserted': result.insertedCount,
          'worker.new_total_processed': this.processedCount
        });
        
        log.info(`Processed ${result.insertedCount} votes (Total: ${this.processedCount})`);
        
        return result.insertedCount;
      } catch (error) {
        log.error('Error processing vote batch:', error);
        this.errorCount++;
        span.recordException(error);
        throw error;
      }
    });
  }

  async start() {
    log.info('Starting vote worker...');
    this.isRunning = true;
    
    while (this.isRunning) {
      try {
        const processed = await this.processVoteBatch();
        
        // If no votes were processed, wait longer before next poll
        const waitTime = processed === 0 ? config.worker.pollInterval * 2 : config.worker.pollInterval;
        await this.sleep(waitTime);
        
      } catch (error) {
        log.error('Worker error:', error);
        await this.sleep(config.worker.pollInterval * 5); // Wait longer on error
      }
    }
    
    log.info('Vote worker stopped');
  }

  async getStats() {
    try {
      const queueLength = await this.redisClient.lLen('vote_queue');
      const votesCollection = this.db.collection('votes');
      const totalVotes = await votesCollection.countDocuments();
      
      return {
        queueLength,
        totalProcessed: this.processedCount,
        totalVotesInDB: totalVotes,
        errorCount: this.errorCount,
        isRunning: this.isRunning
      };
    } catch (error) {
      log.error('Error getting stats:', error);
      return null;
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Main execution
async function main() {
  const worker = new VoteWorker();
  
  // Graceful shutdown handling
  const shutdown = async (signal) => {
    log.info(`Received ${signal}, shutting down gracefully...`);
    await worker.disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  
  try {
    await worker.connect();
    
    // Log stats periodically
    setInterval(async () => {
      const stats = await worker.getStats();
      if (stats) {
        log.info('Worker Stats:', stats);
      }
    }, 30000); // Every 30 seconds
    
    await worker.start();
  } catch (error) {
    log.error('Worker failed to start:', error);
    process.exit(1);
  }
}

// Start the worker
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});