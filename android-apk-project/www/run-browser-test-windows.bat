@echo off
chcp 65001 >nul
echo 천하패권 브라우저 테스트 서버를 시작합니다.
echo PC와 휴대폰을 같은 Wi-Fi에 연결한 뒤 PC의 IPv4 주소로 접속하세요.
echo 종료하려면 Ctrl+C를 누르세요.
py -m http.server 8000
pause
