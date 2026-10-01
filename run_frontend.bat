@echo off
title GoodWan Warehouse INV - Web Browser App
echo ========================================================
echo   GoodWan Warehouse INV - Web Application
echo   Running at: http://localhost:5173
echo ========================================================
cd /d "%~dp0frontend"
npm run dev
pause
