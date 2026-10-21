@echo off
cd /d "%~dp0"
echo Open the Pixel 6 Pro in Android Studio first (Device Manager - Play).
echo Building and installing SafeDrive (first time 3-5 minutes)...
call flutter run -d emulator-5554 --dart-define-from-file=secrets.json
pause
