@echo off
title 🔨 Build Lumi Frontend
cd /d "%~dp0frontend"
echo ================================================================
echo    🔨 Building Lumi Frontend Assets
echo ================================================================
if not exist "node_modules" (
    echo [*] Installing frontend dependencies...
    call npm install
)
echo [*] Running npm run build...
call npm run build
echo.
echo [OK] Build completed! Files are in frontend\dist\
pause
