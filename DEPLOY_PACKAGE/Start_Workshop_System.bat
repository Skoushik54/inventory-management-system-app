@echo off
title Workshop Inventory System - PRODUCTION
echo ****************************************************
echo *     GREYHOUNDS TELANGANA - WORKSHOP SYSTEM       *
echo ****************************************************
echo.

:: Check for Java
java -version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Java 17 not found. Please install Java to run the backend.
    pause
    exit /b
)

:: Check for Node
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Please install Node.js to run the frontend.
    pause
    exit /b
)

echo [1/2] Starting Secure Backend (Port 8080)...
start /b java -jar inventory-system.jar > backend_log.txt 2>&1

echo [2/2] Starting Frontend Web Interface (Port 5173)...
echo.
echo System will be available at: http://localhost:5173
echo.
echo Keep this window open while using the system.
echo Press Ctrl+C to stop.
echo.

:: Using npx to serve the production build without global installs
npx -y serve -s www -l 5173
