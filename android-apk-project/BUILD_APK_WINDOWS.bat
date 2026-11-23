@echo off
chcp 65001 >nul
echo [1/4] Node.js 패키지를 설치합니다.
call npm install || goto :error
echo [2/4] Android 프로젝트를 생성합니다. 최초 1회만 실행하면 됩니다.
if not exist android call npx cap add android || goto :error
echo [3/4] 웹 파일을 Android 프로젝트에 반영합니다.
call npx cap sync android || goto :error
echo [4/4] Android Studio를 엽니다.
call npx cap open android || goto :error
echo Android Studio에서 Build^>Build Bundle(s) / APK(s)^>Build APK(s)를 선택하세요.
pause
exit /b 0
:error
echo 작업에 실패했습니다. README_KO.md의 준비 사항과 오류 안내를 확인하세요.
pause
exit /b 1
