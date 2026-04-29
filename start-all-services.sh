#!/bin/bash

# Unix Shell Script to Start All Microservices for Testing
# Run this script from the root directory of the project
# Usage: ./start-all-services.sh

set -e  # Exit on any error

echo "========================================"
echo "Starting All Microservices for Testing"
echo "========================================"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed or not in PATH"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

echo "Node.js version: $(node --version)"
echo "NPM version: $(npm --version)"

# Set environment variables for local testing
export NODE_ENV=development
export MONGODB_URL=mongodb://localhost:27017
export REDIS_HOST=localhost
export REDIS_PORT=6379
export REGISTRY_URL=http://localhost:4000
export ENABLE_CONSOLE_TRACING=true
export ENABLE_JAEGER_TRACING=false

echo ""
echo "Setting up environment variables for local testing..."
echo "NODE_ENV=$NODE_ENV"
echo "MONGODB_URL=$MONGODB_URL"
echo "REDIS_HOST=$REDIS_HOST"
echo "REGISTRY_URL=$REGISTRY_URL"

echo ""
echo "========================================"
echo "Installing Dependencies"
echo "========================================"

# Function to install dependencies
install_deps() {
    local service_name=$1
    local service_dir=$2
    
    echo "Installing $service_name dependencies..."
    cd "$service_dir"
    
    # Try normal install first
    if npm install; then
        echo "✓ $service_name dependencies installed successfully"
    else
        echo "⚠ $service_name had dependency conflicts, trying with --legacy-peer-deps..."
        if npm install --legacy-peer-deps; then
            echo "✓ $service_name dependencies installed with legacy peer deps"
        else
            echo "⚠ Still having issues, trying with --force..."
            if npm install --force; then
                echo "✓ $service_name dependencies installed with --force"
            else
                echo "✗ Failed to install $service_name dependencies"
                echo "You may need to manually resolve dependency conflicts"
                exit 1
            fi
        fi
    fi
    cd ..
}

# Install dependencies for all services
install_deps "Registry Service" "registry"
install_deps "Users Service" "users-service"
install_deps "Product Service" "product-service"
install_deps "Gateway Service" "gateway-service"
install_deps "Worker Service" "worker-service"
install_deps "Frontend Service" "frontend-service"

echo ""
echo "========================================"
echo "Prerequisites Check"
echo "========================================"

# Check if MongoDB is running
echo "Checking if MongoDB is running on localhost:27017..."
if ! nc -z localhost 27017 2>/dev/null; then
    echo "WARNING: MongoDB not detected on port 27017"
    echo "Please start MongoDB manually or use Docker:"
    echo "  docker run -d -p 27017:27017 --name mongodb mongo:7.0"
    echo ""
fi

# Check if Redis is running
echo "Checking if Redis is running on localhost:6379..."
if ! nc -z localhost 6379 2>/dev/null; then
    echo "WARNING: Redis not detected on port 6379"
    echo "Please start Redis manually or use Docker:"
    echo "  docker run -d -p 6379:6379 --name redis redis:7.2-alpine"
    echo ""
fi

echo ""
echo "========================================"
echo "Starting Services"
echo "========================================"

# Create log directory
mkdir -p logs

# Create PID file to track processes
PID_FILE="./logs/services.pid"
> "$PID_FILE"

# Function to start a service
start_service() {
    local service_name=$1
    local service_dir=$2
    local port=$3
    local log_file=$4
    local extra_env=$5
    
    echo "Starting $service_name on port $port..."
    cd "$service_dir"
    
    # Set port if provided
    if [ ! -z "$port" ]; then
        export SERVICE_PORT=$port
    fi
    
    # Apply extra environment variables
    if [ ! -z "$extra_env" ]; then
        eval "export $extra_env"
    fi
    
    # Start the service in background
    nohup npm start > "../logs/$log_file" 2>&1 &
    local pid=$!
    echo "$pid" >> "../$PID_FILE"
    echo "  Started $service_name with PID $pid"
    
    cd ..
    sleep 2
}

# Start services in order
start_service "Registry Service" "registry" "4000" "registry.log"
sleep 3

start_service "Users Service 1" "users-service" "3001" "users-1.log"
start_service "Users Service 2" "users-service" "3002" "users-2.log"
sleep 3

start_service "Product Service 1" "product-service" "3003" "product-1.log"
start_service "Product Service 2" "product-service" "3004" "product-2.log"
sleep 3

start_service "Gateway Service" "gateway-service" "8080" "gateway.log"
sleep 3

start_service "Worker Service 1" "worker-service" "" "worker-1.log"
start_service "Worker Service 2" "worker-service" "" "worker-2.log"
sleep 3

start_service "Frontend Service" "frontend-service" "3000" "frontend.log"

echo ""
echo "========================================"
echo "Services Started Successfully!"
echo "========================================"
echo ""
echo "Service URLs:"
echo "  Registry Service:  http://localhost:4000"
echo "  Gateway Service:   http://localhost:8080"
echo "  Frontend Service:  http://localhost:3000"
echo "  Users Service 1:   http://localhost:3001"
echo "  Users Service 2:   http://localhost:3002"
echo "  Product Service 1: http://localhost:3003"
echo "  Product Service 2: http://localhost:3004"
echo ""
echo "Health Check URLs:"
echo "  curl http://localhost:4000/health"
echo "  curl http://localhost:8080/health"
echo "  curl http://localhost:3000/api/stats"
echo ""
echo "Log files are available in the 'logs' directory:"
echo "  tail -f logs/registry.log"
echo "  tail -f logs/gateway.log"
echo "  tail -f logs/frontend.log"
echo ""
echo "To stop all services, run: ./stop-all-services.sh"
echo ""

# Wait a moment for services to start
sleep 5

echo "========================================"
echo "Service Health Check"
echo "========================================"

# Function to check service health
check_health() {
    local service_name=$1
    local url=$2
    
    echo -n "Checking $service_name... "
    if curl -s -f "$url" > /dev/null 2>&1; then
        echo "✓ Healthy"
    else
        echo "✗ Not responding (may still be starting)"
    fi
}

check_health "Registry Service" "http://localhost:4000/health"
check_health "Gateway Service" "http://localhost:8080/health"
check_health "Frontend Service" "http://localhost:3000/api/stats"

echo ""
echo "All services are now running!"
echo "Open http://localhost:3000 in your browser to access the application."
echo ""
echo "Process IDs saved to: $PID_FILE"
echo "Use './stop-all-services.sh' to stop all services."
