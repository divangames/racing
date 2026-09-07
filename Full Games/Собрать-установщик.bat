@echo off
chcp 65001 >nul
cd /d "%~dp0"
call npm install
if errorlevel 1 goto :fail
call npm run manifest
if errorlevel 1 goto :fail
call npm run icon
if errorlevel 1 goto :fail
call "%~dp0tools\set-csc.cmd"
if errorlevel 1 goto :fail
echo Сборка установщика Windows ^(без 8 ГБ ассетов внутри exe^).
echo После установки клиент читает Content рядом или папку браузерной игры в режиме разработки.
call npm run dist
if errorlevel 1 goto :fail
echo Готово. Установщик в папке dist
pause
exit /b 0
:fail
echo Сборка не удалась.
pause
exit /b 1
