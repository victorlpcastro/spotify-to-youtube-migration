@echo off
echo =========================================
echo   Iniciando Servidor Spotify to YouTube
echo =========================================
echo.
echo Compilando TypeScript...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo ERRO na compilacao!
    pause
    exit /b 1
)

echo.
echo Iniciando servidor...
echo Pressione Ctrl+C para encerrar
echo.
node dist/index.js
pause
