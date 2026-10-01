@echo off
title GoodWan Warehouse INV - Launcher
echo ========================================================
echo   Launching GoodWan Warehouse Management System
echo   1. Starting Backend Server (FastAPI)
echo   2. Launching Desktop Application (Electron)
echo ========================================================
start "GoodWan Backend" cmd /c "cd /d %~dp0backend && python -m uvicorn app.main:app --host 127.0.0.1 --port 8000"
timeout /t 3 /nobreak >nul
start "GoodWan Desktop" cmd /c "cd /d %~dp0frontend && npm run electron:preview"
echo Services successfully started in separate windows!
