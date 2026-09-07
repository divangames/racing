@echo off
chcp 65001 >nul
cd /d "%~dp0.."
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0ensure-code-cert.ps1"
if errorlevel 1 exit /b 1
if not exist "certs\divan-games.pfx" (
  echo Нет certs\divan-games.pfx
  exit /b 1
)
if not exist "certs\password.txt" (
  echo Нет certs\password.txt
  exit /b 1
)
set /p WIN_CSC_KEY_PASSWORD=<"certs\password.txt"
set "WIN_CSC_LINK=%cd%\certs\divan-games.pfx"
set "CSC_KEY_PASSWORD=%WIN_CSC_KEY_PASSWORD%"
set "CSC_LINK=%WIN_CSC_LINK%"
exit /b 0
