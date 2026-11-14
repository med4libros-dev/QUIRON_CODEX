@echo off
chcp 65001 >nul
title Quiron Codex - crear instalador de Windows
cd /d "%~dp0"
echo.
echo  Crea el instalador de Quiron Codex (.msi y .exe) en esta computadora.
echo  Requisitos (una sola vez): Node.js, Rust (rustup.rs) y "Visual Studio Build Tools" con C++.
echo.
where node >nul 2>nul || (echo [Falta] Node.js: https://nodejs.org & pause & exit /b 1)
where cargo >nul 2>nul || (echo [Falta] Rust: https://rustup.rs  ^(acepta las opciones por defecto^) & pause & exit /b 1)
echo Instalando dependencias...
call npm install || (pause & exit /b 1)
echo Compilando (la primera vez tarda 5-15 minutos)...
call npm run escritorio:instalador || (echo. & echo Si falla por "link.exe" o "MSVC": instala Visual Studio Build Tools con "Desarrollo para el escritorio con C++". & pause & exit /b 1)
echo.
echo Listo. Abriendo la carpeta con los instaladores...
start "" "src-tauri\target\release\bundle"
pause
