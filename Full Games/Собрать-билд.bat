@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Ставлю зависимости...
call npm install
if errorlevel 1 goto :fail
echo Манифест файлов...
call npm run manifest
if errorlevel 1 goto :fail
echo Иконка 256x256...
call npm run icon
if errorlevel 1 goto :fail
call "%~dp0tools\set-csc.cmd"
if errorlevel 1 goto :fail
echo Собираю клиент (exe, без контента)...
call npm run pack
if errorlevel 1 goto :fail
echo Копирую рантайм в Content (без «Материалы»)...
call npm run portable
if errorlevel 1 goto :fail
echo.
echo Готово к передаче: папка dist\win-unpacked
echo Отдайте её целиком (exe + Content). Можно заархивировать.
echo На другом ПК: Колесница войны.exe или Играть.bat
pause
exit /b 0
:fail
echo Сборка билда не удалась.
pause
exit /b 1
