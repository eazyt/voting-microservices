# Local Testing Guide

This guide explains how to run all microservices locally for testing before containerization.

## 🚀 Quick Start

### Prerequisites
- **Node.js 18+** - [Download here](https://nodejs.org/)
- **MongoDB** - Running on localhost:27017
- **Redis** - Running on localhost:6379
- **Git** - For cloning the repository

### One-Command Setup

**Windows:**
```cmd
start-all-services.bat
```

**Linux/macOS:**
```bash
./start-all-services.sh
```

## 📋 Prerequisites Setup

### Install MongoDB
```bash
# Using Docker (Recommended)
docker run -d -p 27017:27017 --name mongodb mongo:7.0

# Or install locally
# Windows: Download from https://www.mongodb.com/try/download/community
# macOS: brew install mongodb-community
# Ubuntu: sudo apt install mongodb
```

### Install Redis
```bash
# Using Docker (Recommended)
docker run -d -p 6379:6379 --name redis redis:7.2-alpine

# Or install locally
# Windows: Download from https://github.com/microsoftarchive/redis/releases
# macOS: brew install redis
# Ubuntu: sudo apt install redis-server
```

### Verify Prerequisites
```bash
# Check MongoDB
mongosh --eval "db.adminCommand('ping')"

# Check Redis
redis-cli ping

# Check Node.js
node --version
npm --version
```

## 🏗️ Service Architecture

### Service Ports
- **Registry Service**: 4000
- **Gateway Service**: 8080
- **Frontend Service**: 3000
- **Users Service 1**: 3001
- **Users Service 2**: 3002
- **Product Service 1**: 3003
- **Product Service 2**: 3004
- **Worker Services**: Background processes (no HTTP port)

### Service Dependencies
```
Registry Service (4000)
    ↓
Users Services (3001, 3002) ← MongoDB
    ↓
Product Services (3003, 3004) ← MongoDB + Redis
    ↓
Gateway Service (8080)
    ↓
Frontend Service (3000) ← MongoDB + Redis
    ↓
Worker Services ← MongoDB + Redis
```

## 🔧 Manual Setup (Alternative)

If you prefer to start services manually:

### 1. Install Dependencies
```bash
# Install all service dependencies
cd registry && npm install && cd ..
cd users-service && npm install && cd ..
cd product-service && npm install && cd ..
cd gateway-service && npm install && cd ..
cd worker-service && npm install && cd ..
cd frontend-service && npm install && cd ..
```

### 2. Set Environment Variables
```bash
export NODE_ENV=development
export MONGODB_URL=mongodb://localhost:27017
export REDIS_HOST=localhost
export REDIS_PORT=6379
export REGISTRY_URL=http://localhost:4000
export ENABLE_CONSOLE_TRACING=true
export ENABLE_JAEGER_TRACING=false
```

### 3. Start Services in Order
```bash
# Terminal 1: Registry Service
cd registry
npm start

# Terminal 2: Users Service 1
cd users-service
SERVICE_PORT=3001 npm start

# Terminal 3: Users Service 2
cd users-service
SERVICE_PORT=3002 npm start

# Terminal 4: Product Service 1
cd product-service
SERVICE_PORT=3003 npm start

# Terminal 5: Product Service 2
cd product-service
SERVICE_PORT=3004 npm start

# Terminal 6: Gateway Service
cd gateway-service
SERVICE_PORT=8080 npm start

# Terminal 7: Worker Service 1
cd worker-service
npm start

# Terminal 8: Worker Service 2
cd worker-service
npm start

# Terminal 9: Frontend Service
cd frontend-service
SERVICE_PORT=3000 npm start
```

## 🧪 Testing the Setup

### Automated Testing
```bash
# Windows
test-services.bat

# Linux/macOS
./test-services.sh
```

### Manual Health Checks
```bash
# Check individual services
curl http://localhost:4000/health    # Registry
curl http://localhost:8080/health    # Gateway
curl http://localhost:3000/api/stats # Frontend
curl http://localhost:3001/health    # Users 1
curl http://localhost:3003/health    # Product 1

# Check service discovery
curl http://localhost:4000/find/users-service/1.0.0
curl http://localhost:4000/find/product-service/1.0.0

# Test gateway routing
curl http://localhost:8080/users
curl http://localhost:8080/products
```

### Web Interface Testing
1. Open http://localhost:3000 in your browser
2. Test user registration and login
3. Test product voting functionality
4. Verify vote processing (check logs)

## 📊 Monitoring & Debugging

### Log Files
All services log to the `logs/` directory:
```bash
# View real-time logs
tail -f logs/registry.log
tail -f logs/gateway.log
tail -f logs/frontend.log
tail -f logs/users-1.log
tail -f logs/product-1.log
tail -f logs/worker-1.log

# View all logs
tail -f logs/*.log
```

### Service Discovery Monitoring
Visit http://localhost:4000 to see registered services:
```bash
# List all registered services
curl http://localhost:4000/services

# Check specific service
curl http://localhost:4000/find/users-service/1.0.0
```

### Database Monitoring
```bash
# MongoDB
mongosh
use userservice
db.users.find().limit(5)

use productservice
db.products.find().limit(5)
db.votes.countDocuments()

# Redis
redis-cli
KEYS *
LLEN vote_queue
```

## 🔧 Troubleshooting

### Common Issues

#### Port Already in Use
```bash
# Find process using port
netstat -tulpn | grep :3000  # Linux
netstat -ano | findstr :3000  # Windows

# Kill process
kill -9 <PID>  # Linux
taskkill /PID <PID> /F  # Windows
```

#### Service Not Registering
1. Check if Registry Service is running on port 4000
2. Verify REGISTRY_URL environment variable
3. Check network connectivity between services
4. Review service logs for registration errors

#### Database Connection Issues
```bash
# Test MongoDB connection
mongosh mongodb://localhost:27017

# Test Redis connection
redis-cli -h localhost -p 6379 ping

# Check if services are using correct connection strings
grep -r "mongodb://" */config/
grep -r "redis" */config/
```

#### Service Discovery Issues
1. Verify Registry Service health: `curl http://localhost:4000/health`
2. Check service registration: `curl http://localhost:4000/services`
3. Verify Gateway can reach Registry: Check gateway logs
4. Ensure services are using correct service names and versions

### Debug Mode
Enable detailed logging by setting:
```bash
export LOG_LEVEL=debug
export ENABLE_CONSOLE_TRACING=true
```

### Performance Issues
```bash
# Monitor system resources
top  # Linux/macOS
tasklist  # Windows

# Check Node.js memory usage
node --max-old-space-size=4096 app.js

# Monitor database performance
mongosh --eval "db.serverStatus()"
redis-cli info memory
```

## 🔄 Development Workflow

### Making Changes
1. Stop affected services
2. Make code changes
3. Restart services
4. Test changes
5. Check logs for errors

### Hot Reloading (Development)
Use nodemon for automatic restarts:
```bash
# Install nodemon globally
npm install -g nodemon

# Start services with nodemon
cd users-service
nodemon bin/run

cd product-service
nodemon bin/run
```

### Testing Individual Services
```bash
# Test specific service endpoints
curl -X POST http://localhost:3001/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com"}'

curl -X POST http://localhost:3003/products \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Product","description":"Test Description"}'

curl -X POST http://localhost:3003/vote \
  -H "Content-Type: application/json" \
  -d '{"productId":"123","userId":"456","vote":"up"}'
```

## 🚦 Stopping Services

### Automated Cleanup
```bash
# Windows
stop-all-services.bat

# Linux/macOS
./stop-all-services.sh
```

### Manual Cleanup
```bash
# Kill all Node.js processes (careful!)
pkill -f node  # Linux/macOS
taskkill /f /im node.exe  # Windows

# Or kill specific processes
kill $(lsof -t -i:3000)  # Kill process on port 3000
```

## 📈 Performance Testing

### Load Testing with curl
```bash
# Test concurrent requests
for i in {1..100}; do
  curl -s http://localhost:8080/products &
done
wait

# Test vote processing
for i in {1..50}; do
  curl -X POST http://localhost:8080/vote \
    -H "Content-Type: application/json" \
    -d "{\"productId\":\"$i\",\"userId\":\"user$i\",\"vote\":\"up\"}" &
done
wait
```

### Monitor Vote Processing
```bash
# Watch Redis queue
watch -n 1 'redis-cli LLEN vote_queue'

# Monitor database writes
mongosh --eval "
  use productservice;
  while(true) {
    print(new Date() + ': Votes count: ' + db.votes.countDocuments());
    sleep(1000);
  }
"
```

## 🔐 Security Considerations

### Local Development Security
- Services run without authentication (development mode)
- Database connections are unencrypted
- No HTTPS/TLS encryption
- CORS is disabled for testing

### Production Preparation
Before containerization, ensure:
1. Environment variables are properly configured
2. Database credentials are secured
3. Service-to-service authentication is implemented
4. HTTPS is enabled for external endpoints
5. Input validation is comprehensive

## 📋 Pre-Containerization Checklist

- [ ] All services start successfully
- [ ] Service discovery is working
- [ ] Database connections are stable
- [ ] Vote processing is functional
- [ ] Gateway routing works correctly
- [ ] Frontend displays data properly
- [ ] Health checks respond correctly
- [ ] Logs are clean (no errors)
- [ ] Performance is acceptable
- [ ] All endpoints are tested

Once all items are checked, you're ready to containerize with Docker!

## 🆘 Getting Help

### Log Analysis
```bash
# Search for errors in logs
grep -i error logs/*.log
grep -i "connection" logs/*.log
grep -i "failed" logs/*.log

# Monitor logs in real-time
tail -f logs/*.log | grep -i error
```

### Service Status
```bash
# Check which services are running
ps aux | grep node  # Linux/macOS
tasklist | findstr node  # Windows

# Check port usage
netstat -tulpn | grep -E ":(3000|3001|3002|3003|3004|4000|8080)"  # Linux
netstat -ano | findstr -E ":(3000|3001|3002|3003|3004|4000|8080)"  # Windows
```

This local testing setup provides a complete development environment that mirrors the production Docker setup, making it easy to develop, test, and debug before containerization.