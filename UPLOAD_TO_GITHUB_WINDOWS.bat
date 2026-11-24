@echo off
chcp 65001 >nul
title 삼국지 천하패권 v1.0.1 GitHub 업로드
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0UPLOAD_TO_GITHUB_WINDOWS.ps1"
echo.
echo 작업이 끝났습니다. 위 결과를 확인해주세요.
pause
