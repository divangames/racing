@echo off
cd /d "%~dp0"
echo Opening game...
call "%~dp0local-server.bat" rnr.html
if errorlevel 1 pause
