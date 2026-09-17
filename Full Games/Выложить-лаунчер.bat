@echo off
chcp 65001 >nul
cd /d "%~dp0"
setlocal EnableExtensions
rem Без EnableDelayedExpansion: в пути проекта есть !!!GAMES, иначе call ломается.

for /f "usebackq delims=" %%i in (`node -p "require('./config/launcher.json').version"`) do set CURRENT=%%i
if "%CURRENT%"=="" goto fail

set VER=%~1
set MODE=%~2

echo.
echo === Выкладка лаунчера ===
echo Сейчас в конфиге: %CURRENT%
echo Новый номер — установленные клиенты сами скачают MSI ^(тег launcher-*^).
echo Тот же номер — MSI на GitHub перезапишется.
echo Аргументы: Выложить-лаунчер.bat [версия^|+^|publish^|local] [publish^|local]
echo.

if /I "%VER%"=="publish" (
  set MODE=publish
  set VER=%CURRENT%
  goto havever
)
if /I "%VER%"=="github" (
  set MODE=publish
  set VER=%CURRENT%
  goto havever
)
if /I "%VER%"=="local" (
  set MODE=local
  set VER=%CURRENT%
  goto havever
)

if not "%VER%"=="" goto havever
echo Enter — оставить %CURRENT%
echo +     — поднять последний сегмент
set /p VER=Версия [Enter / + / номер]:
if "%VER%"=="" set VER=%CURRENT%
if "%VER%"=="+" (
  for /f "usebackq delims=" %%i in (`node tools/bump-version.cjs launcher`) do set VER=%%i
  goto verwritten
)
:havever
if /I "%VER%"=="+" (
  for /f "usebackq delims=" %%i in (`node tools/bump-version.cjs launcher`) do set VER=%%i
  goto verwritten
)
if /I "%VER%"=="bump" (
  for /f "usebackq delims=" %%i in (`node tools/bump-version.cjs launcher`) do set VER=%%i
  goto verwritten
)

echo Пишу версию лаунчера %VER% ...
node tools/set-launcher-version.cjs "%VER%"
if errorlevel 1 goto fail
:verwritten
for /f "usebackq delims=" %%i in (`node -p "require('./config/launcher.json').version"`) do set VER=%%i
echo Версия сборки: %VER%

set MSI_DIST=dist\KolesnicaVoyny-%VER%.msi
set MSI_OUT=out-msi\KolesnicaVoyny-%VER%.msi
if exist "%MSI_DIST%" goto skip_build
if exist "%MSI_OUT%" (
  if not exist dist mkdir dist
  copy /Y "%MSI_OUT%" "%MSI_DIST%" >nul
  goto skip_build
)

call npm install
if errorlevel 1 goto fail
call npm run manifest
if errorlevel 1 goto fail
call npm run icon
if errorlevel 1 goto fail
call "%~dp0tools\set-csc.cmd"
if errorlevel 1 goto fail

echo.
echo Собираю MSI...
call npm run dist:msi
if errorlevel 1 goto fail
if not exist dist mkdir dist
copy /Y "out-msi\KolesnicaVoyny-%VER%.msi" "dist\KolesnicaVoyny-%VER%.msi" >nul
if errorlevel 1 (
  copy /Y "out-msi\KolesnicaVoyny-*.msi" dist\ >nul
)
if not exist "%MSI_DIST%" (
  if not exist "%MSI_OUT%" goto fail
)
echo MSI готов: %MSI_DIST%
goto after_build

:skip_build
echo.
echo MSI уже есть — сборку пропускаю: %MSI_DIST%
if not exist "%MSI_DIST%" if exist "%MSI_OUT%" (
  if not exist dist mkdir dist
  copy /Y "%MSI_OUT%" "%MSI_DIST%" >nul
)

:after_build
if /I "%MODE%"=="local" goto done_local
if /I "%MODE%"=="publish" goto do_publish
if /I "%MODE%"=="github" goto do_publish
if /I "%MODE%"=="gh" goto do_publish

echo.
echo Выложить на GitHub Releases ^(тег launcher-%VER%^)?
echo Установленные лаунчеры подхватят обновление сами.
echo N — только локальная сборка MSI.
set PUBLISH=
set /p PUBLISH=GitHub [Y/N, Enter = Y]:
if "%PUBLISH%"=="" set PUBLISH=Y
if /I "%PUBLISH%"=="Y" goto do_publish
if /I "%PUBLISH%"=="Д" goto do_publish
if /I "%PUBLISH%"=="ДА" goto do_publish
if /I "%PUBLISH%"=="yes" goto do_publish
goto done_local

:do_publish
echo.
echo Заливка MSI на GitHub, тег launcher-%VER% ...
node tools/publish-launcher-release.cjs
if errorlevel 1 goto fail
echo Обновляю ссылки на пейдже и пушу Pages...
node tools/publish-launcher-page-links.cjs "%VER%"
if errorlevel 1 goto fail
echo.
echo Готово. Релиз:
echo   https://github.com/divangames/racing/releases/tag/launcher-%VER%
echo   https://github.com/divangames/racing/releases/download/launcher-%VER%/KolesnicaVoyny-%VER%.msi
echo Сайт: https://divangames.github.io/racing/
echo Клиенты с самообновлением скачают этот MSI при следующем запуске.
pause
exit /b 0

:done_local
echo.
echo Локальная сборка без GitHub. MSI лежит в dist\ и out-msi\.
echo Чтобы выложить позже: Выложить-лаунчер.bat %VER% publish
pause
exit /b 0

:fail
echo.
echo Не удалось собрать или выложить лаунчер.
pause
exit /b 1
