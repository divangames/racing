@echo off
chcp 65001 >nul
cd /d "%~dp0"

for /f "usebackq delims=" %%i in (`node -p "require('./config/game.json').version"`) do set CURRENT=%%i
if "%CURRENT%"=="" goto :fail

set VER=%~1
if "%VER%"=="" (
  echo Сейчас в проекте: %CURRENT%
  echo Новый номер — лаунчер предложит обновление.
  echo Тот же номер — zip на GitHub перезапишется, у кого уже эта версия стоит, кнопка обновления не появится.
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
node -e "const fs=require('fs'),p=require('path');const r=p.resolve('..'),c=p.join(r,'assets','data','cars'),s=p.join(r,'assets','sounds');const cars=fs.readdirSync(c).filter(n=>/^\d+$/.test(n)&&fs.existsSync(p.join(c,n,'car.json')));let wav=0;const walk=d=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const f=p.join(d,e.name);if(e.isDirectory())walk(f);else if(e.name.toLowerCase().endsWith('.wav'))wav++;}};walk(s);if(!cars.length||!wav)throw new Error('Не найдены car.json или WAV');console.log('Машин: '+cars.length+', WAV: '+wav);"
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
