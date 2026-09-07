@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist "node_modules\electron" (
  echo Ставлю зависимости клиента...
  call npm install
  if errorlevel 1 (
    echo Не удалось установить npm-пакеты.
    pause
    exit /b 1
  )
)
if not exist "manifest\integrity.json" (
  echo Собираю манифест файлов...
  call npm run manifest
)
echo Запуск лаунчера...
node tools/sync-launcher-media.cjs
call npm start
if errorlevel 1 pause
