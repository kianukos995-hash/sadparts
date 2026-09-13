Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host ""
Write-Host " SadParts Prices — Windows 11"
Write-Host " Папка: $PWD"
Write-Host ""

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  Write-Host " Node.js не найден. Скачайте LTS 64-bit с https://nodejs.org"
  Write-Host " При установке включите Add to PATH, затем запустите скрипт снова."
  Start-Process "https://nodejs.org/en/download"
  Read-Host "Enter чтобы закрыть"
  exit 1
}

Write-Host " Node: $(node -v)"
Write-Host " npm:  $(npm -v)"
Write-Host ""

if (-not (Test-Path -LiteralPath "package.json")) {
  Write-Host " Распакуйте ZIP через «Извлечь всё», не запускайте изнутри архива."
  Read-Host "Enter чтобы закрыть"
  exit 1
}

if (-not (Test-Path -LiteralPath "node_modules")) {
  Write-Host " Ставлю зависимости..."
  npm install
}
if (-not (Test-Path -LiteralPath ".next")) {
  Write-Host " Собираю программу..."
  npm run build
}

Write-Host ""
Write-Host " Сервер: http://127.0.0.1:43217"
Write-Host " Это окно не закрывайте."
Write-Host ""
Start-Process "http://127.0.0.1:43217"
$env:HOST = "0.0.0.0"
$env:PORT = "43217"
npm start
