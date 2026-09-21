@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo == Aplicando las mejoras de Claude sobre main ==
git checkout main || goto :error
git pull --ff-only origin main || goto :error
git pull --ff-only "%~dp0recordatorios-mejoras.bundle" HEAD || goto :error
echo.
echo == Subiendo a GitHub ==
git push origin main || goto :error
del "%~dp0recordatorios-mejoras.bundle"
echo.
echo LISTO: cambios subidos a GitHub. Ya puedes borrar este archivo.
pause
exit /b 0
:error
echo.
echo Ha habido un error. No se ha subido nada; copia este mensaje a Claude.
pause
exit /b 1
