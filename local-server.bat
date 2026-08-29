@echo off
cd /d "%~dp0"

set "PAGE=%~1"
if "%PAGE%"=="" set "PAGE=rnr.html"
set PORT=8765

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

echo Checking http://127.0.0.1:%PORT%/
where py >nul 2>&1
if errorlevel 1 goto try_python
py -3 "%ROOT%\tools\rnr-ensure-http.py"
if errorlevel 1 goto fail
goto ready

:try_python
where python >nul 2>&1
if errorlevel 1 goto no_python
python "%ROOT%\tools\rnr-ensure-http.py"
if errorlevel 1 goto fail
goto ready

:no_python
echo Python not found. Opening file.
start "" "%ROOT%\%PAGE%"
pause
exit /b 1

:fail
echo Server failed. Opening file.
start "" "%ROOT%\%PAGE%"
pause
exit /b 1

:ready
start "" "http://127.0.0.1:%PORT%/%PAGE%"
