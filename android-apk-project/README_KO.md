# Android APK 제작 안내 (v0.5.0)

- `www/`에 브라우저 게임 소스가 포함되어 있습니다.
- Windows PC에서 Node.js, JDK, Android Studio/SDK를 준비한 뒤 `BUILD_APK_WINDOWS.bat`을 실행합니다.
- Android 휴대폰에서는 BAT 파일을 실행할 수 없습니다.
- 현재 패키지에는 APK 바이너리가 포함되어 있지 않습니다. 실제 빌드·서명·기기 설치 테스트는 별도 작업입니다.
- 브라우저 IndexedDB와 Android 앱 저장 공간은 별개입니다. 기기 이동 전 JSON/텍스트 백업을 권장합니다.
