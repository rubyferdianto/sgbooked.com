@echo off
setlocal

pushd "%~dp0"

if /I "%~1"=="--dry-run" goto :dryrun

if not exist "frontend\package.json" (
  echo Frontend project not found.
  popd
  exit /b 1
)

if not exist "backend\mvnw.cmd" (
  echo Backend Maven wrapper not found.
  popd
  exit /b 1
)

if not exist "frontend\node_modules" (
  echo Installing frontend dependencies...
  call npm install --prefix frontend
  if errorlevel 1 (
    popd
    exit /b 1
  )
)

echo Starting sgbooked backend...
start "sgbooked-backend" cmd /k "cd /d "%~dp0backend" && call mvnw.cmd spring-boot:run"

echo Starting sgbooked frontend...
start "sgbooked-frontend" cmd /k "cd /d "%~dp0frontend" && call npm run dev"

popd
exit /b 0

:dryrun
echo Backend command:
echo   cd /d "%~dp0backend" ^&^& call mvnw.cmd spring-boot:run
echo Frontend command:
echo   cd /d "%~dp0frontend" ^&^& call npm run dev
popd
exit /b 0