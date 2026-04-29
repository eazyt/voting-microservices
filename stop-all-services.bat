@echo off
REM Windows Batch Script to Stop All Microservices
REM Run this script to stop all running Node.js services

echo ========================================
echo Stopping All Microservices
echo ========================================

echo Stopping all Node.js processes...

REM Kill all Node.js processes (be careful - this kills ALL Node.js processes)
taskkill /f /im node.exe >nul 2>&1
if %errorlevel% equ 0 (
    echo Successfully stopped all Node.js processes
) else (
    echo No Node.js processes were running
)

REM Alternative: Kill specific processes by window title (if started with start command)
taskkill /f /fi "WindowTitle eq Registry Service*" >nul 2>&1
taskkill /f /fi "WindowTitle eq Users Service*" >nul 2>&1
taskkill /f /fi "WindowTitle eq Product Service*" >nul 2>&1
taskkill /f /fi "WindowTitle eq Gateway Service*" >nul 2>&1
taskkill /f /fi "WindowTitle eq Worker Service*" >nul 2>&1
taskkill /f /fi "WindowTitle eq Frontend Service*" >nul 2>&1

echo.
echo Checking for remaining processes on service ports...

REM Check if ports are still in use
netstat -an | findstr "3000" >nul && echo WARNING: Port 3000 still in use
netstat -an | findstr "3001" >nul && echo WARNING: Port 3001 still in use
netstat -an | findstr "3002" >nul && echo WARNING: Port 3002 still in use
netstat -an | findstr "3003" >nul && echo WARNING: Port 3003 still in use
netstat -an | findstr "3004" >nul && echo WARNING: Port 3004 still in use
netstat -an | findstr "4000" >nul && echo WARNING: Port 4000 still in use
netstat -an | findstr "8080" >nul && echo WARNING: Port 8080 still in use

echo.
echo ========================================
echo Cleanup Complete
echo ========================================
echo.
echo All microservices have been stopped.
echo Log files are preserved in the 'logs' directory.
echo.
echo To restart services, run: start-all-services.bat
echo.
pause