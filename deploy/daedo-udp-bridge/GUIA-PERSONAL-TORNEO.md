# Guia de uso para personal de torneo

## Una sola vez

1. Instala Node.js LTS desde https://nodejs.org si el ordenador lo pide.
2. Abre `INSTALAR-TKSTRIKE.ps1` con PowerShell.
3. Espera a que diga `Instalacion terminada`.

## Antes de cada torneo

1. Abre `INICIAR-TKSTRIKE.ps1`.
2. Cuando pida `DAEDO_API_KEY`, pega la misma clave configurada en Vercel.
3. Puerto UDP: pulsa Enter para usar `5000`, salvo que TkStrike use otro.
4. Mat: escribe `1`, `2`, etc.
5. No cierres la ventana.

## Configuración en TkStrike

En `External > WT OVR Configuration`:

```text
URL: http://127.0.0.1:5001/api/ovr?mat=1
```

En `External > UDP Event Listeners`:

```text
IP destino: 127.0.0.1
Puerto: 5000
```

Si TkStrike pide una clave HTTP, usa la misma `DAEDO_API_KEY` en el header `X-API-KEY`.

## Prueba rápida

Con el puente abierto, visita en el mismo ordenador:

```text
http://127.0.0.1:5001/health
```

Debe aparecer `ok: true`.

## Qué debe verse

En la ventana negra del puente aparecerán mensajes como:

```text
[TKSTRIKE UDP] ...
[TKSTRIKE FORWARDED] 200
```

Si aparecen paquetes `UNKNOWN`, el puente los está recibiendo pero todavía necesitamos una captura real del protocolo TkStrike para convertir sus bytes en puntos, gam-jeom, reloj y asaltos. No se deben inventar esos valores.

## Importante

- El portátil debe tener Internet para enviar datos al panel web.
- TkStrike y el puente deben estar abiertos durante el torneo.
- No compartas la `DAEDO_API_KEY` públicamente.
- El panel web se consulta en https://tkdcore.vercel.app.
