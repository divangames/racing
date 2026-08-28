@echo off
cd /d "%~dp0"
echo Opening car lab...
call "%~dp0local-server.bat" Editor.html
if errorlevel 1 pause
