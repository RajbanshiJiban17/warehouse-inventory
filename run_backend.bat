@echo off
title GoodWan Warehouse INV - Backend Server
echo ========================================================
echo   GoodWan Warehouse INV - Backend API Server
echo   Running at: http://127.0.0.1:8000
echo   API Docs:   http://127.0.0.1:8000/docs
echo ========================================================
cd /d "%~dp0backend"
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
pause
