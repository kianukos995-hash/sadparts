@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo  SadParts Prices — запуск на Windows 11
echo  Папка: %CD%
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo  Node.js не найден. Нужен Node.js 20 LTS ^(64-bit^).
  echo  Сейчас откроется https://nodejs.org — скачайте LTS, поставьте галочку
  echo  "Add to PATH", затем закройте это окно и запустите файл ещё раз.
  echo.
  start "" "https://nodejs.org/en/download"
  pause
  exit /b 1
)

echo  Node:
node -v
echo  npm:
call npm -v
echo.

if not exist "package.json" (
  echo  Ошибка: вы открыли архив, не распаковав его.
  echo  В Проводнике: правый клик по sadparts-prices.zip → Извлечь всё...
  echo  Затем откройте start-windows.bat уже ВНУТРИ распакованной папки.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo  Ставлю зависимости. Первый раз это несколько минут...
  call npm install
  if errorlevel 1 (
    echo  npm install не удался. Проверьте интернет и антивирус.
    pause
    exit /b 1
  )
)

if not exist ".next\" (
  echo  Собираю программу...
  call npm run build
  if errorlevel 1 (
    echo  Сборка не удалась.
    pause
    exit /b 1
  )
)

echo.
echo  Сервер: http://127.0.0.1:43217
echo  Если Windows спросит доступ к сети — разрешите для Node.js.
echo  Окно браузера откроется само. Это окно не закрывайте.
echo.

start "" "http://127.0.0.1:43217"
set HOST=0.0.0.0
set PORT=43217
call npm start
echo.
echo  Сервер остановлен.
pause
