@echo off
cd /d "%~dp0"
echo End-to-end test on the emulator (open Pixel 6 Pro first)... > e2e_log.txt
call flutter test integration_test -d emulator-5554 >> e2e_log.txt 2>&1
echo ===== DONE >> e2e_log.txt
