@echo off
chcp 65001 >nul
cd /d "%~dp0"

for /f "usebackq delims=" %%i in (`node -p "require('./config/launcher.json').version"`) do set CURRENT=%%i
if "%CURRENT%"=="" goto fail

set VER=%~1
if not "%VER%"=="" goto havever
echo Сейчас лаунчер: %CURRENT%
echo Новый номер - клиент сам скачает MSI.
echo Тот же номер - MSI на GitHub перезапишется.
set /p VER=Версия [Enter = %CURRENT%]: 
if "%VER%"=="" set VER=%CURRENT%
:havever

echo Пишу версию лаунчера %VER% ...
node tools/set-launcher-version.cjs "%VER%"
if errorlevel 1 goto fail
for /f "usebackq delims=" %%i in (`node -p "require('./config/launcher.json').version"`) do set VER=%%i

call npm install
if errorlevel 1 goto fail
call npm run manifest
if errorlevel 1 goto fail
call npm run icon
if errorlevel 1 goto fail
call "%~dp0tools\set-csc.cmd"
if errorlevel 1 goto fail
echo Собираю MSI...
call npm run dist:msi
if errorlevel 1 goto fail
if not exist dist mkdir dist
copy /Y "out-msi\KolesnicaVoyny-*.msi" dist\

echo Заливка MSI на GitHub, тег launcher-%VER%.
node tools/publish-launcher-release.cjs
if errorlevel 1 goto fail
echo Лаунчер выложен.
pause
exit /b 0
:fail
echo Не удалось собрать или выложить лаунчер.
pause
exit /b 1
