@echo off
title 🛑 Stop Lumi Servers
echo ================================================================
echo    🛑 Stopping Lumi Backend (Port 5000) and Frontend (Port 3000)
echo ================================================================

echo [*] Stopping processes on port 5000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5000" ^| findstr "LISTENING"') do (
    taskkill /f /pid %%a >nul 2>nul
)

echo [*] Stopping processes on port 3000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000" ^| findstr "LISTENING"') do (
    taskkill /f /pid %%a >nul 2>nul
)

echo [OK] All Lumi servers stopped.
timeout /t 2 /nobreak >nul
