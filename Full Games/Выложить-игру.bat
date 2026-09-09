@echo off
chcp 65001 >nul
cd /d "%~dp0"

for /f "usebackq delims=" %%i in (`node -p "require('./config/game.json').version"`) do set CURRENT=%%i
if "%CURRENT%"=="" goto :fail

set VER=%~1
if "%VER%"=="" (
  echo Сейчас в проекте: %CURRENT%
  echo Новый номер — лаунчер предложит обновление zip игры.
  echo Тот же номер — zip на GitHub перезапишется, у кого уже эта версия стоит, кнопка обновления игры не появится.
  set /p VER=Версия ^(Enter = %CURRENT%^): 
)
if "%VER%"=="" set VER=%CURRENT%

echo Пишу версию %VER% ...
node tools/set-game-version.cjs "%VER%"
if errorlevel 1 goto :fail
for /f "usebackq delims=" %%i in (`node -p "require('./config/game.json').version"`) do set VER=%%i

call npm run manifest
if errorlevel 1 goto :fail
call npm run pack:game
if errorlevel 1 goto :fail

echo Проверяю содержимое архива: настройки авто и звуки ...
node tools/verify-game-content.cjs
if errorlevel 1 goto :fail

echo Архив готов. Заливка на GitHub (без прокси VPN, HTTP/1.1, IPv4).
node tools/publish-github-release.cjs
if errorlevel 1 goto :fail
echo Релиз готов.
pause
exit /b 0
:fail
echo Не удалось собрать или выложить пакет игры.
pause
exit /b 1
