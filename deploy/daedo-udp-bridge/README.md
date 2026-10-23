# Puente UDP TkStrike -> tkdcore

Vercel no mantiene sockets UDP persistentes. Este proceso debe ejecutarse en un PC o mini-servidor dentro de la misma red que TkStrike.

## Instalación

```powershell
cd deploy/daedo-udp-bridge
npm install
npm run build
```

## Configuración PowerShell

```powershell
$env:DAEDO_UDP_HOST="0.0.0.0"
$env:DAEDO_UDP_PORT="5000"
$env:DAEDO_MAT="1"
$env:TKDCORE_EVENTS_URL="https://tkdcore.vercel.app/api/v1/integrations/daedo/events"
$env:DAEDO_API_KEY="mismo-valor-que-DAEDO_API_KEY-en-Vercel"
$env:DAEDO_RAW_ENCODING="hex"
npm start
```

Configura TkStrike para enviar eventos UDP a la IP del PC que ejecuta el puente y al puerto `DAEDO_UDP_PORT`.

## Simulador independiente TkStrike

Para probar OVR y la secuencia UDP sin abrir TkStrike, consulta [simulator/README.md](simulator/README.md). El ejecutable se conecta al bridge ya iniciado y usa un combate sintetico; no modifica el programa TkStrike original.

## Qué reenvía

Cada datagrama se registra con:

- IP y puerto de origen.
- Fecha de recepción.
- Tamaño del paquete.
- Hexadecimal completo, o base64 si se configura `DAEDO_RAW_ENCODING=base64`.
- `eventId` determinista más secuencia.

El puente no interpreta bytes propietarios como puntos automáticamente. Cuando se disponga de un paquete real/documentación de TkStrike, implementa el parser en `classify` y mapea los campos a `eventType`, `matchId`, `chongScore`, `hongScore`, `gamJeom`, ronda y reloj.

## Endpoints Vercel

### OVR

```text
GET/POST https://tkdcore.vercel.app/api/v1/integrations/daedo/ovr?mat=1
Header: X-API-KEY: ...
```

Respuesta normalizada compatible como adaptador:

```json
{
  "success": true,
  "source": "tkdcore-daedo-ovr",
  "schemaVersion": "1.0",
  "mat": "1",
  "matchId": "match-123",
  "chong": { "name": "", "score": 0, "gamJeom": 0 },
  "hong": { "name": "", "score": 0, "gamJeom": 0 },
  "clock": { "seconds": 0, "running": false }
}
```

TkStrike puede exigir nombres de campos distintos. Usa un ejemplo real de su documentación/exportación para ajustar `app/api/v1/integrations/daedo/ovr/route.ts`.

### Eventos UDP reenviados

```text
POST https://tkdcore.vercel.app/api/v1/integrations/daedo/events
Header: X-API-KEY: ...
Content-Type: application/json
```

## Variables de Vercel

```text
DAEDO_API_KEY=secreto-compartido-con-el-puente
```

Añádela como Secret en Production. No uses `NEXT_PUBLIC_` para esta clave.
