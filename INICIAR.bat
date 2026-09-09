@echo off
cd /d "%~dp0"
title Totali Antecipa
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0servir.ps1"
pause
