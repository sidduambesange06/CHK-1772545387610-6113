@echo off
title ForensicAI - Startup
color 0A

echo ============================================
echo  ForensicAI - Starting All Services
echo ============================================



echo.

:: Kill anything already on our ports
echo [1/4] Clearing ports 3000, 8000, 8080...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000 "') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000 "') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8080 "') do taskkill /F /PID %%a >nul 2>&1
timeout /t 1 >nul

:: ── ML Service (Python FastAPI on :8000) ──────────────────────────────────
echo [2/4] Starting ML Service on port 8000...
cd /d "%~dp0ml-service"
start "ForensicAI - ML Service" cmd /k "python main.py"
cd /d "%~dp0"

:: Give ML service time to load models before API starts
echo      Waiting 5s for ML service to initialize...
timeout /t 5 >nul

:: ── Node.js API (Express on :3000) ────────────────────────────────────────
echo [3/4] Starting API Server on port 3000...
cd /d "%~dp0api"
start "ForensicAI - API Server" cmd /k "node server.js"
cd /d "%~dp0"
timeout /t 2 >nul

:: ── Frontend (static HTML on :8080) ───────────────────────────────────────
echo [4/4] Starting Frontend on port 8080...
cd /d "%~dp0frontend"
start "ForensicAI - Frontend" cmd /k "python -m http.server 8080"
cd /d "%~dp0"

timeout /t 2 >nul


:: ── Open browser ──────────────────────────────────────────────────────────
echo.
echo ============================================
echo  All services started!
echo.
echo  Frontend  ->  http://localhost:8080
echo  API       ->  http://localhost:3000
echo  ML Docs   ->  http://localhost:8000/docs
echo ============================================
echo.
echo Opening browser...
start http://localhost:8080

echo.
echo This window can be closed. Services run in their own windows.
pause
