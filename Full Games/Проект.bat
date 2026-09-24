@echo off
chcp 65001 >nul
setlocal EnableExtensions DisableDelayedExpansion
cd /d "%~dp0"
set "ROOT=%~dp0.."

if not "%~1"=="" goto dispatch

:menu
cls
echo ============================================================
echo              КОЛЕСНИЦА ВОЙНЫ — ПРОЕКТ
echo ============================================================
echo.
echo   Запуск и файлы
echo    1. Запустить игру
echo    2. Открыть DiVANEngine
echo    3. Синхронизировать контент
echo    4. Проверить файлы и манифест
echo.
echo   Сборка и релизы
echo    5. Собрать портативный билд
echo    6. Собрать EXE-установщик
echo    7. Собрать MSI-установщик
echo    8. Выложить игру
echo    9. Выложить лаунчер
echo.
echo   Git и сайты
echo   10. Commit
echo   11. Push
echo   12. Commit + Push
echo   13. Обновить Pages
echo   14. Обновить диздок
echo   15. Обновить Pages + диздок
echo   16. ВСЁ: Pages + диздок + Commit + Push
echo   17. Показать git status
echo   18. Доверить сертификату Divan Games
echo.
echo    0. Выход
echo.
set "CHOICE="
set /p CHOICE=Выберите действие: 
if "%CHOICE%"=="1" call :start_game
if "%CHOICE%"=="2" call :start_editor
if "%CHOICE%"=="3" call :sync_content
if "%CHOICE%"=="4" call :manifest
if "%CHOICE%"=="5" call :build_portable
if "%CHOICE%"=="6" call :build_nsis
if "%CHOICE%"=="7" call :build_msi
if "%CHOICE%"=="8" call :publish_game
if "%CHOICE%"=="9" call :publish_launcher
if "%CHOICE%"=="10" call :commit
if "%CHOICE%"=="11" call :push
if "%CHOICE%"=="12" call :commit_push
if "%CHOICE%"=="13" call :update_page
if "%CHOICE%"=="14" call :update_dizdoc
if "%CHOICE%"=="15" call :update_sites
if "%CHOICE%"=="16" call :publish_all
if "%CHOICE%"=="17" call :status
if "%CHOICE%"=="18" call :trust_certificate
if "%CHOICE%"=="0" exit /b 0
echo.
pause
goto menu

:dispatch
if /I "%~1"=="start" goto command_start
if /I "%~1"=="editor" goto command_editor
if /I "%~1"=="sync" goto command_sync
if /I "%~1"=="manifest" goto command_manifest
if /I "%~1"=="build" goto command_build
if /I "%~1"=="nsis" goto command_nsis
if /I "%~1"=="msi" goto command_msi
if /I "%~1"=="game-release" goto command_game_release
if /I "%~1"=="launcher-release" goto command_launcher_release
if /I "%~1"=="commit" goto command_commit
if /I "%~1"=="push" goto command_push
if /I "%~1"=="commit-push" goto command_commit_push
if /I "%~1"=="page" goto command_page
if /I "%~1"=="dizdoc" goto command_dizdoc
if /I "%~1"=="sites" goto command_sites
if /I "%~1"=="all" goto command_all
if /I "%~1"=="status" goto command_status
if /I "%~1"=="trust" goto command_trust
echo Неизвестная команда: %~1
echo Запустите Проект.bat без аргументов, чтобы увидеть меню.
exit /b 2

:command_start
call :start_game
exit /b %errorlevel%
:command_editor
call :start_editor
exit /b %errorlevel%
:command_sync
call :sync_content
exit /b %errorlevel%
:command_manifest
call :manifest
exit /b %errorlevel%
:command_build
call :build_portable
exit /b %errorlevel%
:command_nsis
call :build_nsis
exit /b %errorlevel%
:command_msi
call :build_msi
exit /b %errorlevel%
:command_game_release
call :publish_game %~2
exit /b %errorlevel%
:command_launcher_release
call :publish_launcher %~2 %~3
exit /b %errorlevel%
:command_commit
call :commit %~2
exit /b %errorlevel%
:command_push
call :push
exit /b %errorlevel%
:command_commit_push
call :commit_push %~2
exit /b %errorlevel%
:command_page
call :update_page
exit /b %errorlevel%
:command_dizdoc
call :update_dizdoc
exit /b %errorlevel%
:command_sites
call :update_sites
exit /b %errorlevel%
:command_all
call :publish_all %~2
exit /b %errorlevel%
:command_status
call :status
exit /b %errorlevel%
:command_trust
call :trust_certificate
exit /b %errorlevel%

:ensure_dependencies
if exist "node_modules\electron" exit /b 0
echo Ставлю зависимости...
call npm install
exit /b %errorlevel%

:prepare_build
call :ensure_dependencies
if errorlevel 1 exit /b 1
call npm run manifest
if errorlevel 1 exit /b 1
call npm run icon
if errorlevel 1 exit /b 1
call "%~dp0tools\set-csc.cmd"
exit /b %errorlevel%

:start_game
call :ensure_dependencies
if errorlevel 1 exit /b 1
node tools/prepare-content.cjs
if errorlevel 1 exit /b 1
node tools/sync-launcher-media.cjs
if errorlevel 1 exit /b 1
call npm start
exit /b %errorlevel%

:start_editor
call :ensure_dependencies
if errorlevel 1 exit /b 1
call npm run start:editor
exit /b %errorlevel%

:sync_content
call npm run sync
exit /b %errorlevel%

:manifest
call npm run manifest
exit /b %errorlevel%

:build_portable
call :prepare_build
if errorlevel 1 exit /b 1
call npm run pack
if errorlevel 1 exit /b 1
call npm run portable
if errorlevel 1 exit /b 1
echo Готово: dist\win-unpacked
exit /b 0

:build_nsis
call :prepare_build
if errorlevel 1 exit /b 1
call npm run dist
if errorlevel 1 exit /b 1
echo Готово: установщик в dist\
exit /b 0

:build_msi
call :prepare_build
if errorlevel 1 exit /b 1
node tools/prefetch-builder-binaries.cjs
if errorlevel 1 exit /b 1
call npm run dist:msi
if errorlevel 1 exit /b 1
if not exist dist mkdir dist
copy /Y "out-msi\KolesnicaVoyny-*.msi" dist\ >nul
echo Готово: MSI в dist\ и out-msi\
exit /b 0

:publish_game
for /f "usebackq delims=" %%i in (`node -p "require('./config/game.json').version"`) do set "CURRENT=%%i"
set "VER=%~1"
if not defined VER set /p VER=Версия игры [Enter = %CURRENT%]: 
if not defined VER set "VER=%CURRENT%"
node tools/set-game-version.cjs "%VER%"
if errorlevel 1 exit /b 1
call npm run manifest
if errorlevel 1 exit /b 1
call npm run pack:game
if errorlevel 1 exit /b 1
node tools/verify-game-content.cjs
if errorlevel 1 exit /b 1
node tools/publish-github-release.cjs
exit /b %errorlevel%

:publish_launcher
for /f "usebackq delims=" %%i in (`node -p "require('./config/launcher.json').version"`) do set "CURRENT=%%i"
set "VER=%~1"
set "MODE=%~2"
if not defined VER set /p VER=Версия лаунчера [Enter = %CURRENT%, + = поднять]: 
if not defined VER set "VER=%CURRENT%"
if "%VER%"=="+" for /f "usebackq delims=" %%i in (`node tools/bump-version.cjs launcher`) do set "VER=%%i"
if not "%VER%"=="+" node tools/set-launcher-version.cjs "%VER%"
if errorlevel 1 exit /b 1
for /f "usebackq delims=" %%i in (`node -p "require('./config/launcher.json').version"`) do set "VER=%%i"
set "MSI_DIST=dist\KolesnicaVoyny-%VER%.msi"
if exist "%MSI_DIST%" goto launcher_ready
call :build_msi
if errorlevel 1 exit /b 1
:launcher_ready
if /I "%MODE%"=="local" (
  echo Локальная MSI готова: %MSI_DIST%
  exit /b 0
)
if not defined MODE set /p MODE=Выложить на GitHub? [Y/N, Enter = Y]: 
if not defined MODE set "MODE=Y"
if /I "%MODE%"=="N" exit /b 0
if /I "%MODE%"=="Н" exit /b 0
node tools/publish-launcher-release.cjs
if errorlevel 1 exit /b 1
node tools/publish-launcher-page-links.cjs "%VER%"
exit /b %errorlevel%

:update_page
for /f "usebackq delims=" %%i in (`node -p "require('./config/launcher.json').version"`) do set "VER=%%i"
node tools/update-launcher-download-links.cjs "%VER%" page
exit /b %errorlevel%

:update_dizdoc
for /f "usebackq delims=" %%i in (`node -p "require('./config/launcher.json').version"`) do set "VER=%%i"
node tools/update-launcher-download-links.cjs "%VER%" dizdoc
exit /b %errorlevel%

:update_sites
for /f "usebackq delims=" %%i in (`node -p "require('./config/launcher.json').version"`) do set "VER=%%i"
node tools/update-launcher-download-links.cjs "%VER%" all
exit /b %errorlevel%

:commit
set "COMMIT_MESSAGE=%~1"
if not defined COMMIT_MESSAGE set /p COMMIT_MESSAGE=Текст commit [Enter = Обновить проект.]: 
if not defined COMMIT_MESSAGE set "COMMIT_MESSAGE=Обновить проект."
git -C "%ROOT%" add -A
if errorlevel 1 exit /b 1
git -C "%ROOT%" diff --cached --quiet
if not errorlevel 1 (
  echo Нет изменений для commit.
  exit /b 0
)
git -C "%ROOT%" commit -m "%COMMIT_MESSAGE%"
exit /b %errorlevel%

:push
git -C "%ROOT%" push origin main
exit /b %errorlevel%

:commit_push
call :commit %~1
if errorlevel 1 exit /b 1
call :push
exit /b %errorlevel%

:publish_all
call :update_sites
if errorlevel 1 exit /b 1
call :commit %~1
if errorlevel 1 exit /b 1
call :push
exit /b %errorlevel%

:status
git -C "%ROOT%" status --short --branch
exit /b %errorlevel%

:trust_certificate
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\trust-divan-cert.ps1"
exit /b %errorlevel%
