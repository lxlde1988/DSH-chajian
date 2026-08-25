@echo off
title DeepSeek Harness Web
cd /d "D:\deepseek harness"

echo ============================================
echo    DeepSeek Harness Web Launcher
echo    Open browser at: http://127.0.0.1:3080
echo    Press Ctrl+C to stop the server
echo ============================================
echo.

REM Method 1: run the cached dsh bin.js directly with node (fastest)
set "NODE=C:\Program Files\nodejs\node.exe"
set "DSH_BIN=C:\Users\Administrator\AppData\Local\npm-cache\_npx\1e7f6d9597241db0\node_modules\@deepseek-ai\dsh\lib\bin.js"
if exist "%NODE%" if exist "%DSH_BIN%" goto run_direct
goto run_npx

:run_direct
echo [start] node "%DSH_BIN%" web
"%NODE%" "%DSH_BIN%" web
goto done

REM Method 2: fallback to npx (downloads on first run, then cached)
:run_npx
echo [start] npx -y @deepseek-ai/dsh web
npx -y @deepseek-ai/dsh web

:done
echo.
echo DeepSeek Harness exited. Press any key to close.
pause
