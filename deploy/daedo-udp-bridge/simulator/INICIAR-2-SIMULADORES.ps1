# Lanza 2 simuladores (Gen1 y Gen2) contra los 2 puentes. Ambos leen combates del OVR del puente 1 (5001).
$exe = Join-Path $PSScriptRoot "TkStrike-Match-Control.exe"
Start-Process $exe -ArgumentList "--bridge","http://127.0.0.1:5001","--udp-port","5000","--mat","1","--port","5177"
Start-Process $exe -ArgumentList "--bridge","http://127.0.0.1:5001","--udp-port","5002","--mat","2","--port","5178"
Write-Host "Simulador Gen1: http://127.0.0.1:5177  (UDP 5000, tapiz 1)"
Write-Host "Simulador Gen2: http://127.0.0.1:5178  (UDP 5002, tapiz 2)"
