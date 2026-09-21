@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo == Aplicando las mejoras de Claude ==
git rev-parse --abbrev-ref HEAD
git pull --ff-only origin main
if errorlevel 1 echo (Aviso: tu rama local tiene commits propios; continuo igualmente.)
git fetch "%~dp0mejoras-claude-2.bundle" HEAD || goto :error
echo.
git merge --ff-only FETCH_HEAD
if errorlevel 1 (
  echo == No se pudo avanzar en linea recta: fusiono ==
  git merge --no-edit FETCH_HEAD || goto :conflict
)
echo.
echo == Subiendo a GitHub ==
git push origin main || goto :error
echo.
git --no-pager log --oneline -3
del "%~dp0mejoras-claude-2.bundle" 2>nul
del "%~dp0recordatorios-mejoras.bundle" 2>nul
echo.
echo LISTO: cambios subidos a GitHub. Ya puedes borrar este archivo .bat
pause
exit /b 0
:conflict
echo.
echo Hay conflictos al fusionar. Ejecuta "git merge --abort" y pega este mensaje a Claude.
pause
exit /b 1
:error
echo.
echo Ha habido un error. No se ha subido nada; copia este mensaje a Claude.
pause
exit /b 1
