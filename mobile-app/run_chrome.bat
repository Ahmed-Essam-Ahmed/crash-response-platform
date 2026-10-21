@echo off
cd /d "%~dp0"
echo Starting SafeDrive in Chrome (first time takes ~1 minute)...
call flutter run -d chrome
pause
