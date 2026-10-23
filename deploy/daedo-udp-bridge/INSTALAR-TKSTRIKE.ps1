$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "TKDCORE - Instalacion del puente TkStrike" -ForegroundColor Cyan
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Node.js no esta instalado." -ForegroundColor Red
  Write-Host "1. Abre https://nodejs.org"
  Write-Host "2. Descarga la version LTS"
  Write-Host "3. Instalala con las opciones por defecto"
  Write-Host "4. Reinicia el ordenador y ejecuta este archivo otra vez"
  Read-Host "Pulsa Enter para cerrar"
  exit 1
}

npm install
npm run build
Write-Host "Instalacion terminada. Ahora ejecuta INICIAR-TKSTRIKE.ps1" -ForegroundColor Green
Read-Host "Pulsa Enter para cerrar"
