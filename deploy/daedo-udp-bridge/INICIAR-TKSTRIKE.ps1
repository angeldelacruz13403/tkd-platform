$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host " TKDCORE - PUENTE LOCAL TKSTRIKE / DAEODO" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "ERROR: Node.js no esta instalado." -ForegroundColor Red
  Write-Host "Instala Node.js LTS desde https://nodejs.org y vuelve a ejecutar este archivo."
  Read-Host "Pulsa Enter para cerrar"
  exit 1
}

$secureApiKey = Read-Host "Pega la DAEDO_API_KEY configurada en Vercel" -AsSecureString
$apiKeyPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureApiKey)
try {
  $apiKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($apiKeyPointer)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($apiKeyPointer)
}
if ([string]::IsNullOrWhiteSpace($apiKey)) {
  Write-Host "ERROR: La clave no puede estar vacia." -ForegroundColor Red
  Read-Host "Pulsa Enter para cerrar"
  exit 1
}

$portInput = Read-Host "Puerto UDP de TkStrike [5000]"
$udpPort = if ([string]::IsNullOrWhiteSpace($portInput)) { "5000" } else { $portInput }
$httpInput = Read-Host "Puerto HTTP OVR del puente [5001] (usa 5003 para el segundo puente)"
$httpPort = if ([string]::IsNullOrWhiteSpace($httpInput)) { "5001" } else { $httpInput }
$matInput = Read-Host "Numero de pista / mat [1]"
$mat = if ([string]::IsNullOrWhiteSpace($matInput)) { "1" } else { $matInput }
$resourceType = "matches"
$phaseInput = Read-Host "Fase OVR TkStrike [R64]"
$phase = if ([string]::IsNullOrWhiteSpace($phaseInput)) { "R64" } else { $phaseInput }
$testInput = Read-Host "Modo de prueba sin datos reales (s/N)"
$ovrTest = if ($testInput -match '^(s|si|sÃ­|y|yes)$') { "1" } else { "0" }

if (-not (Test-Path "node_modules")) {
  Write-Host "Instalando dependencias..." -ForegroundColor Yellow
  npm install
}

Write-Host "Preparando el puente local..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
  Write-Host "ERROR: No se pudo compilar el puente. No se iniciara un proceso roto." -ForegroundColor Red
  Read-Host "Pulsa Enter para cerrar"
  exit $LASTEXITCODE
}

$env:DAEDO_UDP_HOST = "0.0.0.0"
$env:DAEDO_UDP_PORT = $udpPort
$env:DAEDO_HTTP_HOST = "127.0.0.1"
$env:DAEDO_HTTP_PORT = $httpPort
$env:DAEDO_MAT = $mat
$env:DAEDO_OVR_RESOURCE_TYPE = $resourceType
$env:DAEDO_OVR_PHASE = $phase
$env:DAEDO_OVR_TEST = $ovrTest
$env:TKDCORE_EVENTS_URL = "https://tkdcore.vercel.app/api/v1/integrations/daedo/events"
$env:TKDCORE_OVR_URL = "https://tkdcore.vercel.app/api/v1/integrations/daedo/ovr"
$env:DAEDO_API_KEY = $apiKey
$env:DAEDO_RAW_ENCODING = "hex"

Write-Host ""
Write-Host "Configura TkStrike con estos valores:" -ForegroundColor Green
Write-Host "  OVR URL: http://127.0.0.1:$httpPort/api/ovr"
Write-Host "  UDP IP destino: 127.0.0.1"
Write-Host "  UDP puerto destino: $udpPort"
Write-Host "  Tipo OVR JSON: $resourceType"
Write-Host "  Fase OVR: $phase"
Write-Host ""
if ($ovrTest -eq "1") {
  Write-Host "MODO PRUEBA ACTIVO: TkStrike vera el combate ficticio OVR-TEST-001, no los datos reales del panel web." -ForegroundColor Yellow
} else {
  Write-Host "Modo real activo: los combates y torneos enviados desde el panel web apareceran en TkStrike." -ForegroundColor Green
}
Write-Host ""
Write-Host "El puente esta arrancando. No cierres esta ventana durante el torneo." -ForegroundColor Green
npm start


