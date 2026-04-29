# Microservices Architecture with Redis Voting Queue System & OpenTelemetry Observability

A complete microservices system featuring service discovery, load balancing, Redis-based vote queuing, worker node processing, EJS frontend interface, and comprehensive OpenTelemetry tracing for full observability across all services.

## Architecture Overview

- **Registry Service**: Service discovery and registration (Port 4000)
- **Gateway Service**: API gateway with load balancing (Port 80)
- **User Service**: User management with MongoDB backend (Random port)
- **Product Service**: Product catalog and Redis vote queuing (Random port)
- **Worker Service**: Processes votes from Redis to MongoDB (Background process)
- **Frontend Service**: EJS web interface for voting (Port 3000)
- **OpenTelemetry**: Distributed tracing across all services with Jaeger integration

## 🔍 OpenTelemetry Observability Features

### Comprehensive Tracing

- **Distributed Tracing**: End-to-end request tracing across all microservices
- **Custom Spans**: Business logic instrumentation with detailed attributes
- **Automatic Instrumentation**: HTTP, Express, MongoDB, Redis, and Axios calls
- **Error Tracking**: Exception recording and error status propagation
- **Performance Monitoring**: Request duration and throughput metrics

### Tracing Endpoints

- **Jaeger UI**: http://localhost:16686 (when Jaeger is running)
- **Prometheus Metrics**: Each service exposes metrics on port 9090+
- **Console Tracing**: Development mode shows traces in console logs

### Instrumented Operations

- **Gateway Service**: Service discovery, load balancing, request routing
- **User Service**: Database queries, user lookups, list operations
- **Product Service**: Product queries, vote queuing to Redis, real-time counts
- **Worker Service**: Batch processing, Redis consumption, MongoDB persistence
- **Frontend Service**: Page rendering, vote submissions, statistics aggregation

## Vote Processing Flow

1. **Vote Submission**: User votes through frontend → Gateway → Product Service
2. **Redis Queue**: Product Service queues vote in Redis with authentication
3. **Worker Processing**: Worker node consumes votes from Redis queue
4. **MongoDB Persistence**: Worker updates MongoDB with processed votes
5. **Real-time Display**: Frontend shows both pending (Redis) and processed (MongoDB) votes
6. **Distributed Tracing**: Full request flow tracked across all services

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (running on localhost:27017)
- Redis (running on localhost:6379 with auth: username=default, password=votingpass123)
- Jaeger (optional, for trace visualization)
- Administrator privileges (for port 80 access)

## Infrastructure Setup

### MongoDB

```bash
# Start MongoDB
mongod
```

### Redis with Authentication

```bash
# Configure Redis with basic authentication
redis-server --requirepass votingpass123

# Or configure in redis.conf:
# requirepass votingpass123
# user default on >votingpass123 ~* &* +@all
```

### Jaeger (Optional - for trace visualization)

```bash
# Run Jaeger all-in-one
docker run -d --name jaeger \
  -p 16686:16686 \
  -p 14268:14268 \
  jaegertracing/all-in-one:latest

# Access Jaeger UI at http://localhost:16686
```

## Services

### 1. Registry Service

- **Port**: 4000 (fixed)
- **Purpose**: Service discovery and registration
- **Tracing**: Service registration/deregistration spans

### 2. Gateway Service

- **Port**: 80
- **Purpose**: API gateway with load balancing and service discovery
- **Tracing**: Request routing, service discovery, load balancing decisions

### 3. User Service (MongoDB)

- **Port**: Random
- **Database**: MongoDB (`userservice` database)
- **Auto-initialization**: Loads users.json data into MongoDB on first startup
- **Tracing**: Database operations, user queries, data retrieval

### 4. Product Service (Redis + MongoDB)

- **Port**: Random
- **Queue**: Redis (`vote_queue` list)
- **Database**: MongoDB (`productservice` database)
- **Purpose**: Product catalog and vote queuing with Redis authentication
- **Tracing**: Product queries, Redis operations, vote queuing

### 5. Worker Service

- **Type**: Background process
- **Purpose**: Consumes votes from Redis queue and persists to MongoDB
- **Features**: Batch processing, error handling, statistics logging
- **Tracing**: Batch processing operations, Redis consumption, MongoDB writes

### 6. Frontend Service (EJS)

- **Port**: 3000
- **Purpose**: Web interface for voting with real-time statistics
- **Features**: Bootstrap UI, real-time vote counts, toast notifications
- **Tracing**: Page rendering, vote submissions, database aggregations

## Quick Start

### 1. Start Infrastructure

```bash
# Start MongoDB
mongod

# Start Redis with authentication
redis-server --requirepass votingpass123

# Start Jaeger (optional)
docker run -d --name jaeger -p 16686:16686 -p 14268:14268 jaegertracing/all-in-one:latest
```

### 2. Install Dependencies & Start Services

```bash
# Install dependencies for all services
for service in registry users-service product-service gateway-service worker-service frontend-service; do
  cd $service && npm install && cd ..
done

# Start Registry Service
cd registry && npm start &

# Start User Service
cd users-service && npm start &

# Start Product Service
cd product-service && npm start &

# Start Gateway (as Administrator)
cd gateway-service && sudo npm start &

# Start Worker Node
cd worker-service && npm start &

# Start Frontend Interface
cd frontend-service && npm start &
```

## 🔍 Observability & Monitoring

### Jaeger Tracing

Visit **http://localhost:16686** to view distributed traces:

- **Service Map**: Visual representation of service dependencies
- **Trace Timeline**: Request flow across services with timing
- **Error Analysis**: Failed requests and exception details
- **Performance Insights**: Latency analysis and bottleneck identification

### Trace Examples

- **Vote Submission Flow**: Frontend → Gateway → Product Service → Redis
- **Worker Processing**: Redis → Worker → MongoDB with batch details
- **User Queries**: Gateway → User Service → MongoDB with query details
- **Service Discovery**: Gateway → Registry → Target Service selection

### Custom Span Attributes

Each service adds detailed attributes to spans:

```javascript
// Example span attributes
{
  'operation': 'vote_for_product',
  'product.id': 'prod_001',
  'user.id': 'user123',
  'user.ip': '192.168.1.100',
  'service.instance.ip': '127.0.0.1',
  'service.instance.port': 54321,
  'service.instance.version': '1.0.0',
  'votes.redis_count': 5,
  'votes.mongo_count': 23,
  'votes.total_estimated': 28
}
```

### Environment Variables for Tracing

```bash
# OpenTelemetry Configuration
export SERVICE_NAME="my-service"
export SERVICE_VERSION="1.0.0"
export NODE_ENV="production"
export JAEGER_ENDPOINT="http://localhost:14268/api/traces"
export ENABLE_CONSOLE_TRACING="false"
export ENABLE_JAEGER_TRACING="true"
export ENABLE_PROMETHEUS_METRICS="true"
export PROMETHEUS_PORT="9090"
```

## Web Interface

Visit **http://localhost:3000** for:

- **Product Grid**: All products with live vote statistics
- **Real-time Counts**:
  - Orange numbers = Pending votes in Redis queue
  - Green numbers = Processed votes in MongoDB
  - Blue numbers = Total estimated votes
- **Interactive Voting**: Click to vote with immediate feedback
- **Auto-refresh**: Statistics update every 5 seconds
- **Responsive Design**: Bootstrap-based mobile-friendly interface

## API Endpoints

### Gateway API (http://localhost/)

#### User Management

- `GET /user-list` - Get full user information
- `GET /user-list-short` - Get abbreviated user information
- `GET /user-names` - Get user names only
- `GET /user/:shortname` - Get specific user details

#### Product & Voting

- `GET /products` - Get all products
- `GET /products/:productId` - Get specific product
- `POST /vote/:productId` - Submit vote (queued to Redis)
- `GET /votes/:productId` - Get processed votes from MongoDB
- `GET /votes-realtime/:productId` - Get real-time vote counts (Redis + MongoDB)
- `GET /top-products?limit=10` - Get top voted products
- `GET /vote-stats` - Get all voting statistics

#### System

- `GET /health` - Gateway health check

### Frontend API (http://localhost:3000/)

- `GET /` - Main voting interface
- `POST /vote/:productId` - Submit vote via frontend
- `GET /api/stats` - Real-time statistics API

## Example API Usage

### Submit Vote with Tracing

```bash
curl -X POST http://localhost/vote/prod_001 \
  -H "Content-Type: application/json" \
  -H "traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01" \
  -d '{"userId": "user123"}'
```

### Get Real-time Vote Count

```bash
curl http://localhost/votes-realtime/prod_001
```

Response with tracing metadata:

```json
{
  "source": "product-service",
  "serviceVersion": "1.0.0",
  "serviceEndpoint": "127.0.0.1:54321",
  "data": {
    "productId": "prod_001",
    "pendingVotes": 5,
    "persistedVotes": 23,
    "totalEstimated": 28
  }
}
```

## Data Flow Architecture with Tracing

```
Frontend (EJS) → Gateway (Port 80) → Product Service → Redis Queue
     ↓               ↓                      ↓              ↓
  Tracing         Tracing              Tracing        Tracing
     ↓               ↓                      ↓              ↓
Worker Service ← MongoDB ← Vote Processing ← Redis Consumer
     ↓               ↓
  Tracing         Tracing
     ↓               ↓
Frontend Statistics ← Real-time Data ← MongoDB + Redis
```

## Configuration

### Environment Variables

- `NODE_ENV` - Environment (development/production/test)
- `MONGODB_URL` - MongoDB connection string
- `MONGODB_DB` - Database name
- `REDIS_HOST` - Redis host (default: localhost)
- `REDIS_PORT` - Redis port (default: 6379)
- `REDIS_USERNAME` - Redis username (default: default)
- `REDIS_PASSWORD` - Redis password (default: votingpass123)
- `GATEWAY_URL` - Gateway service URL for frontend

### Worker Configuration

- `BATCH_SIZE` - Votes processed per batch (default: 10)
- `POLL_INTERVAL` - Queue polling interval in ms (default: 1000)
- `MAX_RETRIES` - Maximum retry attempts (default: 3)

### OpenTelemetry Configuration

- `JAEGER_ENDPOINT` - Jaeger collector endpoint
- `ENABLE_CONSOLE_TRACING` - Show traces in console (development)
- `ENABLE_JAEGER_TRACING` - Send traces to Jaeger
- `ENABLE_PROMETHEUS_METRICS` - Enable Prometheus metrics export
- `PROMETHEUS_PORT` - Prometheus metrics port

## Monitoring & Statistics

### Distributed Tracing Benefits

- **Request Flow Visualization**: See complete request paths across services
- **Performance Bottlenecks**: Identify slow operations and database queries
- **Error Propagation**: Track how errors spread through the system
- **Service Dependencies**: Understand service interaction patterns
- **Load Balancing Effectiveness**: Monitor service instance selection

### Worker Logs with Tracing

```
🔍 OpenTelemetry tracing initialized for service: worker-service
📊 Jaeger endpoint: http://localhost:14268/api/traces
📈 Prometheus metrics port: 9090

Worker Stats: {
  queueLength: 15,
  totalProcessed: 1250,
  totalVotesInDB: 1250,
  errorCount: 2,
  isRunning: true
}
```

### Frontend Statistics with Tracing

Real-time statistics with trace correlation:

- Total products available
- Pending votes in Redis queue
- Total votes cast (processed + pending)
- Per-product vote breakdown
- Request trace IDs for debugging

## Troubleshooting with Tracing

### Redis Authentication Issues

```bash
# Test Redis connection
redis-cli -a votingpass123 ping

# Check traces in Jaeger for Redis connection errors
```

### Service Discovery Issues

- Check Jaeger traces for service discovery failures
- Verify service registration spans in registry service
- Monitor load balancing decisions in gateway traces

### Performance Issues

- Use Jaeger to identify slow database queries
- Monitor Redis queue processing times in worker traces
- Analyze request latency across service boundaries

### Error Debugging

- Search Jaeger for error spans and exceptions
- Follow trace IDs through logs for detailed error context
- Monitor error propagation across service calls

## Load Testing with Tracing

Test the system under load while monitoring traces:

#loadtest.sh script
```bash
#!/bin/bash

# Submit multiple votes with trace headers
users=("jira" "gitlab" "jenkins" "confluence" "docker" "test_user")
products=("prod_001" "prod_002" "prod_003" "prod_004" "prod_005" "prod_006" "prod_007")

for i in {1..10000}; do
  # Pick user and product based on loop index
  user=${users[$(( (i-1) % ${#users[@]} ))]}
  product=${products[$(( (i-1) % ${#products[@]} ))]}

  curl -X POST http://localhost/vote/$product \
    -H "Content-Type: application/json" \
    -H "traceparent: 00-$(openssl rand -hex 16)-$(openssl rand -hex 8)-01" \
    -d "{\"userId\": \"$user\"}" &
#sleep 0.05
done

wait

# Monitor traces in Jaeger to see:
# - Request distribution across service instances
# - Queue processing performance
# - Database write patterns
# - Error rates and bottlenecks
```

The system provides a complete, production-ready microservices architecture with comprehensive observability, real-time vote processing, queue management, and an intuitive web interface for product voting!
