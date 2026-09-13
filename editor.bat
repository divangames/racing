@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo DiVANEngine — десктопный редактор, не браузер.
call "%~dp0Full Games\DiVANEngine.bat"
if errorlevel 1 pause
