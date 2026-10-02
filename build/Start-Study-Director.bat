@echo off
cd /d "%~dp0"
where py >nul 2>nul
if errorlevel 1 (
  python serve-local.py
) else (
  py -3 serve-local.py
)
if errorlevel 1 pause
