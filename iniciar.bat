@echo off
title Quiron Codex
cd /d "%~dp0"
where node >/dev/null 2>nul
if errorlevel 1 (
  echo.
  echo  Falta Node.js. Instala la version LTS desde https://nodejs.org y vuelve a abrir este archivo.
  echo.
  start https://nodejs.org
  pause
  exit /b 1
)
if not exist node_modules (
  echo Instalando dependencias ^(solo la primera vez^)...
  call npm install
  if errorlevel 1 (
    echo No se pudieron instalar las dependencias. Revisa tu conexion a internet.
    pause
    exit /b 1
  )
)
echo Abriendo Quiron Codex en tu navegador... (cierra esta ventana para detenerla)
call npm run dev
pause
