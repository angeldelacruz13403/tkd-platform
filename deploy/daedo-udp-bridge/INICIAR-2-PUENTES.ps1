# Lanza DOS puentes en el mismo PC: Gen1 (tapiz 1) y Gen2 (tapiz 2)
Set-Location $PSScriptRoot
if (-not (Test-Path "node_modules")) { npm install }
npm run build
if ($LASTEXITCODE -ne 0) { Read-Host "Error compilando"; exit 1 }
$secure = Read-Host "Pega la DAEDO_API_KEY de Vercel" -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try { $key = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
$phase = Read-Host "Fase OVR [R64]"; if (-not $phase) { $phase = "R64" }

function Start-Bridge($mat, $udp, $http) {
  $cmd = "`$env:DAEDO_UDP_HOST='0.0.0.0';`$env:DAEDO_UDP_PORT='$udp';`$env:DAEDO_HTTP_HOST='127.0.0.1';`$env:DAEDO_HTTP_PORT='$http';`$env:DAEDO_MAT='$mat';" +
    "`$env:DAEDO_OVR_RESOURCE_TYPE='matches';`$env:DAEDO_OVR_PHASE='$phase';`$env:DAEDO_OVR_TEST='0';" +
    "`$env:TKDCORE_EVENTS_URL='https://tkdcore.vercel.app/api/v1/integrations/daedo/events';" +
    "`$env:TKDCORE_OVR_URL='https://tkdcore.vercel.app/api/v1/integrations/daedo/ovr';" +
    "`$env:DAEDO_API_KEY='$key';`$env:DAEDO_RAW_ENCODING='hex';" +
    "`$host.UI.RawUI.WindowTitle='Puente TAPIZ $mat';Set-Location '$PSScriptRoot';npm start"
  Start-Process powershell -ArgumentList "-NoExit","-Command",$cmd
}
Start-Bridge 1 5000 5001
Start-Bridge 2 5002 5003
Write-Host "Tapiz 1 (TkStrike Gen1): UDP 127.0.0.1:5000 | OVR http://127.0.0.1:5001/api/ovr"
Write-Host "Tapiz 2 (TkStrike Gen2): UDP 127.0.0.1:5002 | OVR http://127.0.0.1:5003/api/ovr"

