@echo off
chcp 65001 >nul
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\trust-divan-cert.ps1"
if errorlevel 1 (
  echo Не вышло поставить сертификат Divan Games в хранилище.
  pause
  exit /b 1
)
echo Готово. Этот Windows теперь знает издателя Divan Games.
echo Чужие компьютеры без этого шага всё равно могут показать SmartScreen.
pause
exit /b 0
