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
echo Качаю WiX в кэш ^(через GitHub CLI, без обрыва TLS у electron-builder^).
node tools/prefetch-builder-binaries.cjs
if errorlevel 1 goto :fail
echo Сборка MSI лаунчера без файлов игры.
call npm run dist:msi
if errorlevel 1 goto :fail
if not exist dist mkdir dist
copy /Y "out-msi\KolesnicaVoyny-*.msi" dist\
echo Готово. MSI в папке dist и out-msi ^(KolesnicaVoyny-версия.msi^)
pause
exit /b 0
:fail
echo Сборка не удалась.
pause
exit /b 1
