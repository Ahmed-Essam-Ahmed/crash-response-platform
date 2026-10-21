@echo off
cd /d "%~dp0"
set ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe
echo Keep this window open. Reproduce the problem in the app, then close this window. > run_log.txt
"%ADB%" logcat -c
start "" /b cmd /c ""%ADB%" logcat -v time *:E flutter:V > logcat.txt 2>&1"
echo Starting SafeDrive with logging... reproduce the problem, then close this window.
call flutter run -d emulator-5554 --dart-define-from-file=secrets.json >> run_log.txt 2>&1
