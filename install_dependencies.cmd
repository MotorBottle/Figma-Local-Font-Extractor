@echo off
SETLOCAL

REM Set the directory where the bundled Python is located
SET PYTHON_DIR=%~dp0..\python

REM Ensure the Python executable and Scripts directory are in the PATH
SET PATH=%PYTHON_DIR%;%PYTHON_DIR%\Scripts;%PATH%

REM Optionally check Python version
%PYTHON_DIR%\python.exe --version

REM Optionally list installed packages to verify the environment
%PYTHON_DIR%\python.exe -m pip list

ENDLOCAL
