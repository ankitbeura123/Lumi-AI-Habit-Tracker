@echo off
setlocal enabledelayedexpansion
title 🌌 Lumi - Habit & Schedule Companion Launcher

:: Set current directory to the script root directory
cd /d "%~dp0"

echo ================================================================
echo    🌌 LUMI - Intelligent AI Habit ^& Schedule Companion
echo ================================================================
echo.

:: 1. Check Python installation
echo [*] Checking Python environment...
where python >nul 2>nul
if %errorlevel% neq 0 (
    where py >nul 2>nul
    if %errorlevel% neq 0 (
        echo [ERROR] Python is not found in your system PATH!
        echo Please install Python 3.10+ from https://www.python.org/
        pause
        exit /b 1
    ) else (
        set "PYTHON_CMD=py"
    )
) else (
    set "PYTHON_CMD=python"
)

:: 2. Check Node.js and npm installation
echo [*] Checking Node.js and npm...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not found in your system PATH!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] npm is not found in your system PATH!
    pause
    exit /b 1
)

:: 3. Setup Backend Environment
echo.
echo ================================================================
echo    1/3 : Setting up Backend (Python VirtualEnv)
echo ================================================================
if not exist "backend\venv\Scripts\python.exe" (
    echo [*] Creating virtual environment in backend\venv...
    %PYTHON_CMD% -m venv backend\venv
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to create virtual environment.
        pause
        exit /b 1
    )
    echo [*] Installing backend dependencies from requirements.txt...
    backend\venv\Scripts\python.exe -m pip install --upgrade pip
    backend\venv\Scripts\python.exe -m pip install -r backend\requirements.txt
) else (
    echo [OK] Backend virtual environment found.
)

if not exist "backend\.env" (
    echo [*] Creating default backend\.env...
    (
        echo PORT=5000
        echo # MISTRAL_API_KEY=your_mistral_api_key_here
    ) > backend\.env
)

:: 4. Setup Frontend & Build
echo.
echo ================================================================
echo    2/3 : Setting up Frontend ^& Building Assets
echo ================================================================
cd frontend
if not exist "node_modules" (
    echo [*] Installing frontend npm dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] npm install failed.
        cd ..
        pause
        exit /b 1
    )
) else (
    echo [OK] Frontend node_modules found.
)

echo [*] Building production frontend bundle (npm run build)...
call npm run build
if %errorlevel% neq 0 (
    echo [WARNING] npm run build encountered an issue, continuing...
)
cd ..

:: 5. Launch Servers
echo.
echo ================================================================
echo    3/3 : Launching Servers (Backend ^& Frontend)
echo ================================================================
echo [*] Starting Flask Backend API on http://localhost:5000 ...
start "Lumi Backend Server (Port 5000)" cmd /c "cd /d %~dp0backend && .\venv\Scripts\python.exe app.py"

echo [*] Starting Vite Frontend Server on http://localhost:3000 ...
start "Lumi Frontend Server (Port 3000)" cmd /c "cd /d %~dp0frontend && npm run dev"

echo.
echo [*] Waiting for services to initialize...
timeout /t 3 /nobreak >nul

echo [*] Opening Lumi in your default browser...
start http://localhost:3000

echo.
echo ================================================================
echo    🚀 Lumi is up and running!
echo ================================================================
echo    Frontend (Vite UI):    http://localhost:3000
echo    Backend (Flask API):   http://localhost:5000
echo    Health Check:          http://localhost:5000/api/health
echo ================================================================
echo.
echo To stop servers, close their command windows or run stop.bat.
echo.
pause
