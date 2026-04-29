@echo off
REM Windows Batch Script to Test All Microservices
REM Run this after starting all services to verify they're working

echo ========================================
echo Testing All Microservices
echo ========================================

REM Check if curl is available
curl --version >nul 2>&1
if %errorlevel% neq 0 (
    echo WARNING: curl is not available. Using PowerShell Invoke-WebRequest instead.
    set USE_POWERSHELL=1
) else (
    set USE_POWERSHELL=0
)

echo.
echo Testing service health endpoints...
echo.

REM Function to test HTTP endpoint
if %USE_POWERSHELL%==1 (
    echo Testing Registry Service Health...
    powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:4000/health' -UseBasicParsing; Write-Host '✓ Registry Service: HTTP' $response.StatusCode } catch { Write-Host '✗ Registry Service: Failed -' $_.Exception.Message }"
    
    echo Testing Gateway Service Health...
    powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:8080/health' -UseBasicParsing; Write-Host '✓ Gateway Service: HTTP' $response.StatusCode } catch { Write-Host '✗ Gateway Service: Failed -' $_.Exception.Message }"
    
    echo Testing Frontend Service Health...
    powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:3000/api/stats' -UseBasicParsing; Write-Host '✓ Frontend Service: HTTP' $response.StatusCode } catch { Write-Host '✗ Frontend Service: Failed -' $_.Exception.Message }"
    
    echo Testing Users Service 1...
    powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:3001/health' -UseBasicParsing; Write-Host '✓ Users Service 1: HTTP' $response.StatusCode } catch { Write-Host '✗ Users Service 1: Failed -' $_.Exception.Message }"
    
    echo Testing Product Service 1...
    powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:3003/health' -UseBasicParsing; Write-Host '✓ Product Service 1: HTTP' $response.StatusCode } catch { Write-Host '✗ Product Service 1: Failed -' $_.Exception.Message }"
) else (
    echo Testing Registry Service Health...
    curl -s -f http://localhost:4000/health >nul && echo ✓ Registry Service: Healthy || echo ✗ Registry Service: Failed
    
    echo Testing Gateway Service Health...
    curl -s -f http://localhost:8080/health >nul && echo ✓ Gateway Service: Healthy || echo ✗ Gateway Service: Failed
    
    echo Testing Frontend Service Health...
    curl -s -f http://localhost:3000/api/stats >nul && echo ✓ Frontend Service: Healthy || echo ✗ Frontend Service: Failed
    
    echo Testing Users Service 1...
    curl -s -f http://localhost:3001/health >nul && echo ✓ Users Service 1: Healthy || echo ✗ Users Service 1: Failed
    
    echo Testing Product Service 1...
    curl -s -f http://localhost:3003/health >nul && echo ✓ Product Service 1: Healthy || echo ✗ Product Service 1: Failed
)

echo.
echo ========================================
echo Port Availability Check
echo ========================================

echo Checking service ports...
netstat -an | findstr "3000" >nul && echo ✓ Port 3000 (Frontend) - In Use || echo ✗ Port 3000 (Frontend) - Available
netstat -an | findstr "3001" >nul && echo ✓ Port 3001 (Users 1) - In Use || echo ✗ Port 3001 (Users 1) - Available
netstat -an | findstr "3002" >nul && echo ✓ Port 3002 (Users 2) - In Use || echo ✗ Port 3002 (Users 2) - Available
netstat -an | findstr "3003" >nul && echo ✓ Port 3003 (Product 1) - In Use || echo ✗ Port 3003 (Product 1) - Available
netstat -an | findstr "3004" >nul && echo ✓ Port 3004 (Product 2) - In Use || echo ✗ Port 3004 (Product 2) - Available
netstat -an | findstr "4000" >nul && echo ✓ Port 4000 (Registry) - In Use || echo ✗ Port 4000 (Registry) - Available
netstat -an | findstr "8080" >nul && echo ✓ Port 8080 (Gateway) - In Use || echo ✗ Port 8080 (Gateway) - Available

echo.
echo ========================================
echo Service Discovery Test
echo ========================================

if %USE_POWERSHELL%==1 (
    echo Testing service registration...
    powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:4000/find/users-service/1.0.0' -UseBasicParsing; Write-Host '✓ Users service registered' } catch { Write-Host '✗ Users service not registered' }"
    powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:4000/find/product-service/1.0.0' -UseBasicParsing; Write-Host '✓ Product service registered' } catch { Write-Host '✗ Product service not registered' }"
) else (
    echo Testing service registration...
    curl -s -f http://localhost:4000/find/users-service/1.0.0 >nul && echo ✓ Users service registered || echo ✗ Users service not registered
    curl -s -f http://localhost:4000/find/product-service/1.0.0 >nul && echo ✓ Product service registered || echo ✗ Product service not registered
)

echo.
echo ========================================
echo Gateway Routing Test
echo ========================================

if %USE_POWERSHELL%==1 (
    echo Testing gateway routing...
    powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:8080/users' -UseBasicParsing; Write-Host '✓ Gateway -> Users routing works' } catch { Write-Host '✗ Gateway -> Users routing failed' }"
    powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:8080/products' -UseBasicParsing; Write-Host '✓ Gateway -> Products routing works' } catch { Write-Host '✗ Gateway -> Products routing failed' }"
) else (
    echo Testing gateway routing...
    curl -s -f http://localhost:8080/users >nul && echo ✓ Gateway -^> Users routing works || echo ✗ Gateway -^> Users routing failed
    curl -s -f http://localhost:8080/products >nul && echo ✓ Gateway -^> Products routing works || echo ✗ Gateway -^> Products routing failed
)

echo.
echo ========================================
echo Test Results Summary
echo ========================================
echo.
echo If all tests show ✓, your microservices are running correctly!
echo.
echo Access Points:
echo   Frontend Web UI:    http://localhost:3000
echo   API Gateway:        http://localhost:8080
echo   Registry Service:   http://localhost:4000
echo.
echo Next Steps:
echo   1. Open http://localhost:3000 in your browser
echo   2. Test the voting functionality
echo   3. Check logs in the 'logs' directory
echo   4. Monitor service discovery at http://localhost:4000
echo.
pause