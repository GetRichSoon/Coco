@echo off
rem Wakes Coco Core (if it is not awake yet) and opens the Coco app window.
cd /d "%~dp0"
powershell -NoProfile -Command "try { Invoke-WebRequest -UseBasicParsing http://localhost:7777/api/brain -TimeoutSec 2 | Out-Null; exit 0 } catch { exit 1 }"
if errorlevel 1 (
  start "Coco Core" /min node heart\server.mjs
  timeout /t 2 /nobreak >nul
)
start "" chrome --app=http://localhost:7777 --window-size=1280,860
