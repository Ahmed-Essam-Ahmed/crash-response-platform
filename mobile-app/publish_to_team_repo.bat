@echo off
setlocal
cd /d "%~dp0"
set SRC=%~dp0
set REPO_URL=https://github.com/Ahmed-Essam-Ahmed/crash-response-platform.git
set WORK=%~dp0..\_publish\crash-response-platform
set BRANCH=feat/safedrive-mobile-app
set LOG=%~dp0publish_log.txt
echo SafeDrive publish started %date% %time% > "%LOG%"

where git >nul 2>&1 || (echo Git is not installed. & echo NO_GIT >> "%LOG%" & pause & exit /b 1)

echo [1/4] Unit + widget tests...
echo ===== flutter test >> "%LOG%"
call flutter test >> "%LOG%" 2>&1
if errorlevel 1 (echo Unit tests FAILED - nothing pushed. & echo RESULT: TESTS_FAILED >> "%LOG%" & pause & exit /b 1)

echo [2/4] End-to-end test on the emulator (keep Pixel 6 Pro open, ~3 min)...
echo ===== e2e >> "%LOG%"
call flutter test integration_test -d emulator-5554 >> "%LOG%" 2>&1
if errorlevel 1 (echo E2E test FAILED - nothing pushed. & echo RESULT: E2E_FAILED >> "%LOG%" & pause & exit /b 1)

echo [3/4] Preparing a clean copy of the team repo...
echo ===== git >> "%LOG%"
if not exist "%WORK%\.git" (
  git clone "%REPO_URL%" "%WORK%" >> "%LOG%" 2>&1 || (echo Clone failed. & echo RESULT: CLONE_FAILED >> "%LOG%" & pause & exit /b 1)
)
pushd "%WORK%"
git fetch origin >> "%LOG%" 2>&1
git checkout -B %BRANCH% origin/main >> "%LOG%" 2>&1 || (popd & echo RESULT: CHECKOUT_FAILED >> "%LOG%" & pause & exit /b 1)
for /f "delims=" %%i in ('git config user.name') do set GN=%%i
if "%GN%"=="" git config user.name "Hazem"
for /f "delims=" %%i in ('git config user.email') do set GE=%%i
if "%GE%"=="" (set /p GE=Your GitHub email: )
if not "%GE%"=="" git config user.email "%GE%"

rem Replace mobile-app with the Flutter app (old React Native files are removed on this branch only).
robocopy "%SRC%." "%WORK%\mobile-app" /MIR /NFL /NDL /NJH /NJS ^
  /XD build .dart_tool .idea .vscode .gradle .git ^
  /XF secrets.json twilio.json *_log.txt emulator_start.txt *.iml >> "%LOG%" 2>&1
if errorlevel 8 (popd & echo Copy failed. & echo RESULT: COPY_FAILED >> "%LOG%" & pause & exit /b 1)

git add -A mobile-app >> "%LOG%" 2>&1
git diff --cached --name-only | findstr /i /c:"secrets.json" /c:"twilio.json" >nul && (git reset -q & popd & echo STOP: secret file staged. & echo RESULT: SECRET_BLOCKED >> "%LOG%" & pause & exit /b 1)
git commit -m "mobile-app: SafeDrive Flutter app (Member B)" -m "Screens, emergency workflow, sensor-fusion engine reference, Test Mode, history + graphs, SQLite storage, offline alert queue + sync, permissions, Telegram/Twilio channels, Firebase rules + function, unit + e2e tests." >> "%LOG%" 2>&1

echo [4/4] Pushing branch %BRANCH% (a GitHub sign-in window may open)...
git push -u origin %BRANCH% >> "%LOG%" 2>&1
if errorlevel 1 (popd & echo Push failed - see publish_log.txt. Ahmed may need to add you as a collaborator. & echo RESULT: PUSH_FAILED >> "%LOG%" & pause & exit /b 1)
popd

echo RESULT: PUSHED >> "%LOG%"
echo.
echo Pushed. Now open this link and press "Create pull request" for Ahmed to review:
echo https://github.com/Ahmed-Essam-Ahmed/crash-response-platform/compare/main...%BRANCH%?expand=1
start "" "https://github.com/Ahmed-Essam-Ahmed/crash-response-platform/compare/main...%BRANCH%?expand=1"
pause
