@echo off
cd /d "%~dp0"
echo Checking emulator... (takes ~1 minute) > emulator_log.txt
echo ===== flutter doctor -v >> emulator_log.txt
call flutter doctor -v >> emulator_log.txt 2>&1
echo ===== emulator list >> emulator_log.txt
"%LOCALAPPDATA%\Android\Sdk\emulator\emulator.exe" -list-avds >> emulator_log.txt 2>&1
echo ===== emulator start >> emulator_log.txt
start "" /b "%LOCALAPPDATA%\Android\Sdk\emulator\emulator.exe" -avd Pixel_6_Pro -verbose >> emulator_start.txt 2>&1
timeout /t 45 /nobreak >nul
call flutter devices >> emulator_log.txt 2>&1
echo ===== DONE >> emulator_log.txt
