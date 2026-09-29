@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo  미리보기 서버를 켭니다.
echo  브라우저에서 http://localhost:5500 으로 접속하세요.
echo.
echo  끄려면 이 창에서 Ctrl+C 를 누르거나 창을 닫으세요.
echo  (이 창을 닫으면 서버도 같이 꺼집니다)
echo.
py -3 -m http.server 5500
if errorlevel 1 python -m http.server 5500
pause
