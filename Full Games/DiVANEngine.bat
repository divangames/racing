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
echo DiVANEngine: отдельное окно редактора, правки в файлы игры.
call npm run start:editor
if errorlevel 1 pause
