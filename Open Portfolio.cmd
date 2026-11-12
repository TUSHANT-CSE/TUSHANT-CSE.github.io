@echo off
set "PORT=4173"
title Tushant - Portfolio Preview
"C:\Program Files\nodejs\node.exe" "%~dp0scripts\site.mjs" serve --open
if errorlevel 1 pause
