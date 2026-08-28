@echo off
cd /d "%~dp0"

set "PAGE=%~1"
if "%PAGE%"=="" set "PAGE=rnr.html"
set PORT=8765

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

powershell -NoProfile -Command "try { $t=New-Object Net.Sockets.TcpClient; $t.Connect('127.0.0.1',8765); $t.Close(); exit 0 } catch { exit 1 }" >nul 2>&1
if errorlevel 1 (
  echo Starting http://127.0.0.1:%PORT%/
  where py >nul 2>&1
  if not errorlevel 1 (
    start "RNR http 8765" /min /d "%ROOT%" py -3 "%ROOT%\tools\rnr-http.py"
  ) else (
    where python >nul 2>&1
    if not errorlevel 1 (
      start "RNR http 8765" /min /d "%ROOT%" python "%ROOT%\tools\rnr-http.py"
    ) else (
      echo Python not found. Opening file.
      start "" "%ROOT%\%PAGE%"
      pause
      exit /b 1
    )
  )
  timeout /t 2 /nobreak >nul
)

powershell -NoProfile -Command "try { $t=New-Object Net.Sockets.TcpClient; $t.Connect('127.0.0.1',8765); $t.Close(); exit 0 } catch { exit 1 }" >nul 2>&1
if errorlevel 1 (
  echo Server failed. Opening file.
  start "" "%ROOT%\%PAGE%"
  pause
  exit /b 1
)

start "" "http://127.0.0.1:%PORT%/%PAGE%"
