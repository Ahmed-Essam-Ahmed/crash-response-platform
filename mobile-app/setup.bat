@echo off
cd /d "%~dp0"
echo SafeDrive check started %date% %time% > setup_log.txt
echo ===== flutter create web >> setup_log.txt
call flutter create . --project-name safedrive --org com.safedrive --platforms web >> setup_log.txt 2>&1
echo ===== flutter analyze >> setup_log.txt
call flutter analyze >> setup_log.txt 2>&1
echo ===== flutter test >> setup_log.txt
call flutter test >> setup_log.txt 2>&1
echo ===== flutter emulators >> setup_log.txt
call flutter emulators >> setup_log.txt 2>&1
echo ===== DONE >> setup_log.txt
