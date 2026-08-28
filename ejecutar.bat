@echo off
rem Abre el simulador. Doble clic desde el explorador de Windows.
cd /d "%~dp0"
python -m interfaz
if errorlevel 1 (
    echo.
    echo La aplicacion termino con error. Copia el mensaje de arriba.
    pause
)
