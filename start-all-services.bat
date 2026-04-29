@echo off
REM Windows Batch Script to Start All Microservices for Testing
REM Run this script from the root directory of the project

echo ========================================
echo Starting All Microservices for Testing
echo ========================================

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Set environment variables for local testing
set NODE_ENV=development
set MONGODB_URL=mongodb://localhost:27017
set REDIS_HOST=localhost
set REDIS_PORT=6379
set REGISTRY_URL=http://localhost:4000
set ENABLE_CONSOLE_TRACING=true
set ENABLE_JAEGER_TRACING=false

echo.
echo Setting up environment variables for local testing...
echo NODE_ENV=%NODE_ENV%
echo MONGODB_URL=%MONGODB_URL%
echo REDIS_HOST=%REDIS_HOST%
echo REGISTRY_URL=%REGISTRY_URL%

echo.
echo ========================================
echo Installing Dependencies
echo ========================================

REM Install dependencies for all services
echo Installing Registry Service dependencies...
cd registry
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Failed to install registry dependencies
    pause
    exit /b 1
)
cd ..

echo Installing Users Service dependencies...
cd users-service
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Failed to install users-service dependencies
    pause
    exit /b 1
)
cd ..

echo Installing Product Service dependencies...
cd product-service
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Failed to install product-service dependencies
    pause
    exit /b 1
)
cd ..

echo Installing Gateway Service dependencies...
cd gateway-service
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Failed to install gateway-service dependencies
    pause
    exit /b 1
)
cd ..

echo Installing Worker Service dependencies...
cd worker-service
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Failed to install worker-service dependencies
    pause
    exit /b 1
)
cd ..

echo Installing Frontend Service dependencies...
cd frontend-service
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Failed to install frontend-service dependencies
    pause
    exit /b 1
)
cd ..

echo.
echo ========================================
echo Prerequisites Check
echo ========================================

echo Checking if MongoDB is running on localhost:27017...
timeout /t 2 /nobreak >nul
netstat -an | findstr "27017" >nul
if %errorlevel% neq 0 (
    echo WARNING: MongoDB not detected on port 27017
    echo Please start MongoDB manually or use Docker:
    echo   docker run -d -p 27017:27017 --name mongodb mongo:7.0
    echo.
)

echo Checking if Redis is running on localhost:6379...
netstat -an | findstr "6379" >nul
if %errorlevel% neq 0 (
    echo WARNING: Redis not detected on port 6379
    echo Please start Redis manually or use Docker:
    echo   docker run -d -p 6379:6379 --name redis redis:7.2-alpine
    echo.
)

echo.
echo ========================================
echo Starting Services
echo ========================================

REM Create log directory
if not exist "logs" mkdir logs

echo Starting Registry Service on port 4000...
cd registry
start "Registry Service" cmd /k "npm start 2>&1 | tee ../logs/registry.log"
cd ..
timeout /t 3 /nobreak >nul

echo Starting Users Service (will auto-assign ports)...
cd users-service
start "Users Service 1" cmd /k "set SERVICE_PORT=3001 && npm start 2>&1 | tee ../logs/users-1.log"
timeout /t 2 /nobreak >nul
start "Users Service 2" cmd /k "set SERVICE_PORT=3002 && npm start 2>&1 | tee ../logs/users-2.log"
cd ..
timeout /t 3 /nobreak >nul

echo Starting Product Service (will auto-assign ports)...
cd product-service
start "Product Service 1" cmd /k "set SERVICE_PORT=3003 && npm start 2>&1 | tee ../logs/product-1.log"
timeout /t 2 /nobreak >nul
start "Product Service 2" cmd /k "set SERVICE_PORT=3004 && npm start 2>&1 | tee ../logs/product-2.log"
cd ..
timeout /t 3 /nobreak >nul

echo Starting Gateway Service on port 8080...
cd gateway-service
start "Gateway Service" cmd /k "set SERVICE_PORT=8080 && npm start 2>&1 | tee ../logs/gateway.log"
cd ..
timeout /t 3 /nobreak >nul

echo Starting Worker Services...
cd worker-service
start "Worker Service 1" cmd /k "npm start 2>&1 | tee ../logs/worker-1.log"
timeout /t 2 /nobreak >nul
start "Worker Service 2" cmd /k "npm start 2>&1 | tee ../logs/worker-2.log"
cd ..
timeout /t 3 /nobreak >nul

echo Starting Frontend Service on port 3000...
cd frontend-service
start "Frontend Service" cmd /k "set SERVICE_PORT=3000 && npm start 2>&1 | tee ../logs/frontend.log"
cd ..

echo.
echo ========================================
echo Services Started Successfully!
echo ========================================
echo.
echo Service URLs:
echo   Registry Service:  http://localhost:4000
echo   Gateway Service:   http://localhost:8080
echo   Frontend Service:  http://localhost:3000
echo   Users Service 1:   http://localhost:3001
echo   Users Service 2:   http://localhost:3002
echo   Product Service 1: http://localhost:3003
echo   Product Service 2: http://localhost:3004
echo.
echo Health Check URLs:
echo   curl http://localhost:4000/health
echo   curl http://localhost:8080/health
echo   curl http://localhost:3000/api/stats
echo.
echo Log files are available in the 'logs' directory
echo.
echo To stop all services, run: stop-all-services.bat
echo Or close all the command windows that opened
echo.
echo Press any key to open the frontend in your browser...
pause >nul
start http://localhost:3000

echo.
echo All services are now running!
echo Check the individual service windows for logs and status.
pause