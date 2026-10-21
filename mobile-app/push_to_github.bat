@echo off
cd /d "%~dp0"
where git >/dev/null 2>&1 || (echo Git is not installed. Get it from https://git-scm.com/download/win then run this again. & pause & exit /b 1)
echo.
echo 1) Create an EMPTY repo on github.com (no README, no .gitignore), e.g. "safedrive".
set /p REPO=2) Paste its URL here (https://github.com/USER/safedrive.git): 
if "%REPO%"=="" (echo No URL given. & pause & exit /b 1)
if not exist .git git init -b main
for /f %%i in ('git config user.name') do set GN=%%i
if "%GN%"=="" set /p GN=Your name for commits: 
if not "%GN%"=="" git config user.name "%GN%"
for /f %%i in ('git config user.email') do set GE=%%i
if "%GE%"=="" set /p GE=Your GitHub email: 
if not "%GE%"=="" git config user.email "%GE%"
git add -A
git diff --cached --name-only | findstr /i /c:"secrets.json" /c:"twilio.json" >/dev/null && (echo STOP: a secrets file is staged. Nothing was pushed. & git reset -q & pause & exit /b 1)
git commit -m "SafeDrive Member B: app shell, emergency workflow, history, test mode, storage, sync, permissions, tests"
git branch -M main
git remote remove origin >/dev/null 2>&1
git remote add origin %REPO%
git push -u origin main
echo.
echo Done. Open %REPO% in the browser to check.
pause
