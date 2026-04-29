#!/bin/bash

# Unix Shell Script to Stop All Microservices
# Run this script to stop all running services started by start-all-services.sh

echo "========================================"
echo "Stopping All Microservices"
echo "========================================"

PID_FILE="./logs/services.pid"

if [ -f "$PID_FILE" ]; then
    echo "Stopping services using PID file..."
    
    while IFS= read -r pid; do
        if [ ! -z "$pid" ] && kill -0 "$pid" 2>/dev/null; then
            echo "Stopping process $pid..."
            kill "$pid" 2>/dev/null
            
            # Wait a moment for graceful shutdown
            sleep 2
            
            # Force kill if still running
            if kill -0 "$pid" 2>/dev/null; then
                echo "Force killing process $pid..."
                kill -9 "$pid" 2>/dev/null
            fi
        fi
    done < "$PID_FILE"
    
    # Remove PID file
    rm "$PID_FILE"
    echo "Removed PID file"
else
    echo "No PID file found. Attempting to stop Node.js processes by name..."
    
    # Alternative method: kill Node.js processes by name
    pkill -f "npm start" 2>/dev/null || echo "No npm processes found"
    pkill -f "node.*bin/run" 2>/dev/null || echo "No service processes found"
    pkill -f "node.*worker.js" 2>/dev/null || echo "No worker processes found"
    pkill -f "node.*app.js" 2>/dev/null || echo "No app processes found"
fi

echo ""
echo "Checking for remaining processes on service ports..."

# Function to check if port is in use
check_port() {
    local port=$1
    local service=$2
    
    if lsof -i :$port >/dev/null 2>&1; then
        echo "WARNING: Port $port ($service) still in use"
        echo "  Processes using port $port:"
        lsof -i :$port | grep LISTEN
    fi
}

check_port 3000 "Frontend Service"
check_port 3001 "Users Service 1"
check_port 3002 "Users Service 2"
check_port 3003 "Product Service 1"
check_port 3004 "Product Service 2"
check_port 4000 "Registry Service"
check_port 8080 "Gateway Service"

echo ""
echo "========================================"
echo "Cleanup Complete"
echo "========================================"
echo ""
echo "All microservices have been stopped."
echo "Log files are preserved in the 'logs' directory."
echo ""
echo "To restart services, run: ./start-all-services.sh"
echo ""

# Optional: Clean up log files (uncomment if desired)
# echo "Cleaning up log files..."
# rm -rf logs/*.log