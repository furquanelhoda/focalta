@echo off
echo Starting Tasnim & Said AI Local Server...
echo ------------------------------------------
echo This script alleviates "Failed to fetch" errors caused by 
echo strict browser security (CORS) when opening HTML files directly.
echo.

where python >nul 2>nul
if %errorlevel%==0 (
    echo [OK] Python found. Starting server on port 8000...
    start http://localhost:8000
    python -m http.server 8000
) else (
    echo [ERROR] Python not found.
    echo Please install Python to run a local server, 
    echo or try using the application directly (may have connection issues).
    pause
)
