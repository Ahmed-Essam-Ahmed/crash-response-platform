@echo off
cd /d "%~dp0"
echo SafeDrive check started %date% %time% > check_log.txt
echo ===== flutter pub get >> check_log.txt
call flutter pub get >> check_log.txt 2>&1
echo ===== flutter analyze >> check_log.txt
call flutter analyze >> check_log.txt 2>&1
echo ===== flutter test >> check_log.txt
call flutter test >> check_log.txt 2>&1
echo ===== DONE >> check_log.txt
