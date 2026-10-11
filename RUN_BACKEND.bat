@echo off
setlocal
cd /d "%~dp0"
echo ==========================================
echo        ENGINUITY BOOKS - BACKEND
echo ==========================================
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js was not found.
  echo Install Node.js 18 or newer from https://nodejs.org/
  echo Then close and reopen this window.
  pause
  exit /b 1
)
node -e "const v=Number(process.versions.node.split('.')[0]); if(v<18){console.error('ERROR: Node.js 18 or newer is required.');process.exit(1)} else console.log('Node.js version OK: '+process.version)"
if errorlevel 1 (pause & exit /b 1)
echo.
echo Starting the backend. Keep this window open while using the website.
echo Website:     http://localhost:3000
echo Health check: http://localhost:3000/api/health
echo Stop server: press Ctrl+C in this window.
echo.
node server.js
if errorlevel 1 echo Backend stopped with an error.
pause
