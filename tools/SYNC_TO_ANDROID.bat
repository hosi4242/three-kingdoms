@echo off
chcp 65001 >nul
REM browser-test 의 앱 파일을 android-apk-project\www 로 복사합니다. (두 폴더의 소스를 항상 같게 유지)
REM README_KO.md 와 .bat 파일은 복사하지 않습니다.
cd /d "%~dp0.."
rmdir /s /q android-apk-project\www 2>nul
mkdir android-apk-project\www
robocopy browser-test android-apk-project\www /E /XF README_KO.md *.bat >nul
echo 복사 완료. 이어서 node tools\verify.mjs 로 검사하세요.
pause
