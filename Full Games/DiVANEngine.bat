@echo off
chcp 65001 >nul
cd /d "%~dp0"
call "%~dp0Проект.bat" editor
set "CODE=%errorlevel%"
if not "%CODE%"=="0" pause
exit /b %CODE%
