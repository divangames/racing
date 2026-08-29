@echo off
chcp 65001 >nul
copy /Y "%~dp0rollback\pre-quarks\rnr.html" "%~dp0rnr.html"
echo Откат: rnr.html восстановлен из rollback\pre-quarks\
pause
