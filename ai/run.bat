@echo off
REM Run FastAPI AI service. Uses port 8000 by default.
REM From project root:  ai\run.bat
REM From ai folder:      run.bat

set PORT=8000
if not "%1"=="" set PORT=%1

echo Starting AI service on http://localhost:%PORT%/
echo Open in Chrome or Edge: http://localhost:%PORT%/
echo.

cd /d "%~dp0"
if exist "..\venv\Scripts\activate.bat" (
  call ..\venv\Scripts\activate.bat
) else if exist "venv\Scripts\activate.bat" (
  call venv\Scripts\activate.bat
)

python -m uvicorn ai_service:app --reload --host 0.0.0.0 --port %PORT%
