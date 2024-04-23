@echo off
SETLOCAL

REM Set the directory where Python is located
SET PYTHON_DIR=%~dp0python

REM Add Python and the Scripts directory to the PATH
SET PATH=%PYTHON_DIR%;%PYTHON_DIR%\Scripts;%PYTHON_DIR%\Lib;%PATH%

ENDLOCAL
