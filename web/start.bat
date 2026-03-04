@echo off
REM ─────────────────────────────────────────────────────────────────────────────
REM  Start the Product Designer Agent web interface (Windows)
REM  Usage: double-click start.bat  or  run it from Terminal
REM ─────────────────────────────────────────────────────────────────────────────

cd /d "%~dp0"

echo.
echo  Product Designer Agent — Web Interface
echo  ----------------------------------------

python --version >nul 2>&1 || (echo Python not found. Install Python 3.11+ from python.org && pause && exit /b 1)

pip show fastapi >nul 2>&1 || (echo Installing dependencies... && pip install -r requirements.txt)

echo  Starting server at http://localhost:8000
echo  Open this URL in your browser.
echo  Press Ctrl+C to stop.
echo.

python server.py
pause
