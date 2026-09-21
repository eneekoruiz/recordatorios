@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo  Aplicando mejoras de cosmetica y accesibilidad
echo ============================================
echo.

git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
  echo ERROR: Copia este archivo .bat y "recordatorios-polish.bundle"
  echo dentro de la carpeta del repositorio "recordatorios" y vuelve a
  echo ejecutarlo desde ahi.
  pause
  exit /b 1
)

if not exist "recordatorios-polish.bundle" (
  echo ERROR: No se encuentra "recordatorios-polish.bundle" en esta carpeta.
  echo Asegurate de guardar ambos archivos juntos dentro de la carpeta del repo.
  pause
  exit /b 1
)

echo [1/5] Leyendo el paquete de cambios...
git fetch recordatorios-polish.bundle review-latest:cosmetica-2026-09-21
if errorlevel 1 (
  echo ERROR al leer el paquete de cambios.
  pause
  exit /b 1
)

echo [2/5] Cambiando a la rama main...
git checkout main
if errorlevel 1 (
  echo ERROR al cambiar a la rama main.
  pause
  exit /b 1
)

echo [3/5] Actualizando main desde GitHub...
git pull origin main
if errorlevel 1 (
  echo ERROR al actualizar main desde GitHub.
  pause
  exit /b 1
)

echo [4/5] Fusionando las mejoras...
git merge cosmetica-2026-09-21 --no-edit
if errorlevel 1 (
  echo ERROR al fusionar los cambios. Puede que haya conflictos: revisalos
  echo manualmente con "git status" antes de continuar.
  pause
  exit /b 1
)

echo [5/5] Subiendo los cambios a GitHub...
git push origin main
if errorlevel 1 (
  echo ERROR al subir a GitHub. Revisa tu conexion o tus credenciales.
  pause
  exit /b 1
)

git branch -d cosmetica-2026-09-21 >nul 2>&1

echo.
echo ============================================
echo  Listo! Los cambios ya estan en GitHub.
echo ============================================
pause