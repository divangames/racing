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
echo Лаборатория: правки пишутся в файлы игры ^(car.json^), не в билд.
call npm run start:lab
if errorlevel 1 pause
