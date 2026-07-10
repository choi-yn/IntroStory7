@echo off
chcp 65001 >nul
cd /d "%~dp0"

netstat -ano | findstr ":8080 " | findstr "LISTENING" >nul
if %errorlevel%==0 (
  echo 서버가 이미 실행 중입니다.
) else (
  start "오프닝스토리 서버" /min python -u -m http.server 8080
  echo 서버를 시작했습니다...
  timeout /t 2 /nobreak >nul
)

set "PROFILE=%TEMP%\opening-story-chrome"
set "URL=http://localhost:8080"

rem Chrome: 별도 프로필로 새 창을 열어야 자동재생 옵션이 적용됩니다.
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
  start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --user-data-dir="%PROFILE%" --autoplay-policy=no-user-gesture-required --app=%URL%
  exit /b 0
)
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
  start "" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" --user-data-dir="%PROFILE%" --autoplay-policy=no-user-gesture-required --app=%URL%
  exit /b 0
)

rem Edge 대체
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
  start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --user-data-dir="%PROFILE%" --autoplay-policy=no-user-gesture-required --new-window "%URL%"
  exit /b 0
)
if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
  start "" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" --user-data-dir="%PROFILE%" --autoplay-policy=no-user-gesture-required --new-window "%URL%"
  exit /b 0
)

echo Chrome/Edge를 찾지 못했습니다. 기본 브라우저로 엽니다.
start "" "%URL%"
