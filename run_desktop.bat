@echo off
title GoodWan Warehouse INV - Electron Desktop App
echo ========================================================
echo   GoodWan Warehouse INV - Desktop Application
echo ========================================================
cd /d "%~dp0frontend"
npm run electron:preview
pause
