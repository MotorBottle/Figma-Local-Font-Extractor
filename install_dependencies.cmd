@echo off
SETLOCAL

@REM REM Set the directory where the bundled Python is located
@REM SET PYTHON_DIR=%~dp0..\python

@REM REM Ensure the Python executable and Scripts directory are in the PATH
@REM SET PATH=%PYTHON_DIR%;%PYTHON_DIR%\Scripts;%PATH%

@REM REM Optionally check Python version
@REM %PYTHON_DIR%\python.exe --version

@REM REM Optionally list installed packages to verify the environment
@REM %PYTHON_DIR%\python.exe -m pip list

ENDLOCAL
