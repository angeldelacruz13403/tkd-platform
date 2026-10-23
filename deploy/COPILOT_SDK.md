# Copilot SDK en Raspberry Pi Zero 2: guía para principiantes

Esta guía instala el servicio directamente en Raspberry Pi OS mediante SSH, sin Docker. Se compila en Windows y se copia a la Pi para evitar trabajo extra en sus 512 MB de RAM.

No pegues contraseñas ni tokens en este chat, capturas de pantalla ni comandos que los muestren en la consola. Los secretos se escribirán directamente en el editor de texto de la Pi o en los diálogos de Vercel.

## Arquitectura y límites

```text
Navegador del coach
  -> Next.js/Vercel: sesión, rol y autorización del atleta
  -> Cloudflare Tunnel HTTPS: servicio Node.js en Raspberry Pi
  -> GitHub Copilot (tu suscripción)
```

El servicio acepta una sola petición simultánea. Las conversaciones no se guardan: el historial vive mientras la página del coach está abierta. El SDK funciona en modo `empty` sin herramientas, por lo que Copilot no tiene acceso a shell, archivos, MCP ni operaciones de escritura y no puede publicar planes o trabajos.

La Raspberry Pi Zero 2 W tiene 512 MB de RAM. El paquete ARM64 del runtime ocupa aproximadamente 137 MB en disco, pero no hay un mínimo oficial de memoria documentado. Es un objetivo experimental: prueba con un coach y una conversación; si hay fallos OOM o latencia alta, mueve el servicio a un host ARM64 con más memoria.

## Necesitas

- Una Raspberry Pi Zero 2 W con Raspberry Pi OS **64-bit** (la salida de `uname -m` debe ser `aarch64`).
- SSH activado y acceso a la Pi desde el PC Windows.
- Node.js 22 en la Pi (el SDK necesita Node.js 20.19+ o 22.12+).
- Una cuenta Cloudflare con un dominio activo en Cloudflare para publicar un hostname HTTPS mediante Tunnel.
- Acceso al proyecto Vercel `tkdcore` y a una cuenta de GitHub con suscripción activa de Copilot y un token fine-grained (ver paso 5). GitHub Models fue retirado y ya no sirve.
- Puertos salientes HTTPS permitidos. No hace falta abrir ni redirigir puertos del router.

### Si todavía no instalaste Raspberry Pi OS

En Raspberry Pi Imager, selecciona Raspberry Pi Zero 2 W y Raspberry Pi OS Lite **(64-bit)**. En los ajustes de la imagen, configura un nombre de usuario, contraseña y red Wi-Fi, y activa SSH. Instala la imagen, enciende la Pi y espera a que se conecte a la Wi-Fi. Busca su dirección IP en la lista de dispositivos conectados del router.

### Cómo copiar y pegar los comandos

- `PS>` significa PowerShell de Windows. Ábrelo desde el menú Inicio.
- Los bloques etiquetados `bash` se ejecutan en la ventana SSH de la Raspberry Pi.
- Copia solo las líneas de comandos, no las explicaciones ni `PS>`.
- Si SSH pregunta si confías en el equipo, escribe `yes` y pulsa Enter.
- Al escribir una contraseña en SSH no aparecen letras ni asteriscos. Es normal: escríbela y pulsa Enter.
- Si un paso falla, detente y resuelve el error antes de continuar.

En los ejemplos, cambia `USUARIO_PI` por el nombre de usuario configurado en Raspberry Pi Imager, `IP_DE_LA_PI` por la IP encontrada en el router, y `copilot.tudominio.com` por un hostname de un dominio tuyo en Cloudflare.

## 1. Comprobar acceso y arquitectura

En PowerShell de Windows, reemplaza el usuario y la IP y ejecuta:

```powershell
ssh USUARIO_PI@IP_DE_LA_PI
```

Escribe la contraseña de la Pi cuando te la pida. Ya estás dentro por SSH si ves una línea de comandos que termina en `$`. Ejecuta allí:

```bash
uname -m
getconf LONG_BIT
cat /etc/os-release
```

Continúa solo si `uname -m` devuelve `aarch64` y `getconf LONG_BIT` devuelve `64`. Si no, detente: hace falta instalar Raspberry Pi OS de 64 bits antes de seguir.

## 2. Instalar Node.js 22 en la Pi

En la ventana SSH de la Pi, instala Node.js 22 desde NodeSource. `sudo` puede pedirte la contraseña SSH; no verás los caracteres mientras la escribes:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version
npm --version
```

`node --version` debe mostrar `v22.12.0` o una versión 22 más reciente. Si muestra una versión menor, detente.

## 3. Compilar y copiar el servicio desde Windows

Abre una **segunda ventana de PowerShell en Windows**. La ruta siguiente es la ubicación del proyecto en este PC:

```powershell
Set-Location C:\Users\angel\.gemini\antigravity-ide\scratch\tkd-platform
Set-Location .\copilot-service
npm ci
npm run build
tar -czf "$env:TEMP\tkd-copilot-service.tgz" --exclude=node_modules --exclude=.env -C . package.json package-lock.json dist
scp "$env:TEMP\tkd-copilot-service.tgz" admin@piamk:~/
```

Reemplaza `USUARIO_PI` e `IP_DE_LA_PI` antes de ejecutar. `npm ci` y `npm run build` deben acabar sin errores; espera a que cada comando termine antes de seguir. `scp` copia el archivo a la carpeta personal de la Pi.

Si Windows dice que `npm` no se reconoce, instala Node.js LTS en Windows desde [nodejs.org](https://nodejs.org/) y vuelve a abrir PowerShell. Si dice que `scp` no se reconoce, instala **OpenSSH Client** desde *Configuración → Sistema → Características opcionales → Ver características*.

## 4. Instalar el SDK ARM64 en la Raspberry Pi

Vuelve a la primera ventana SSH de la Pi:

```bash
sudo install -d -o "$USER" -g "$USER" /opt/tkd-copilot-service
sudo install -d -o "$USER" -g "$USER" /var/lib/tkd-copilot
tar -xzf "$HOME/tkd-copilot-service.tgz" -C /opt/tkd-copilot-service
cd /opt/tkd-copilot-service
npm ci --omit=dev --no-audit --no-fund
```

`npm ci` descargará el SDK y su runtime ARM64, y puede tardar. Si npm informa que no hay paquete compatible, comprueba de nuevo `uname -m` y Node. Si falla por memoria, no lo repitas muchas veces: la Pi puede no ser suficiente y habrá que usar un host ARM64 con más memoria.

## 5. Crear los secretos locales del servicio

Genera un token aleatorio compartido entre la Pi y Vercel:

```bash
openssl rand -hex 32
```

La consola imprimirá una cadena larga. Cópiala en un gestor de contraseñas seguro: la usarás aquí y más tarde en Vercel. No la envíes a nadie ni la pegues en GitHub o en este chat.

Abre el editor de texto:

```bash
sudo nano /etc/tkd-copilot.env
```

Escribe estas líneas. Sustituye los dos valores entre corchetes por tus secretos y no escribas los signos `[ ]`:

```dotenv
PORT=8080
COPILOT_SERVICE_TOKEN=5edc8c91c8912d771b640a26941df2723fb715dcb256266120f28705b60b5954
COPILOT_GITHUB_TOKEN=REDACTED_GITHUB_TOKEN
COPILOT_MODEL=gpt-4.1
COPILOT_DATA_DIR=/var/lib/tkd-copilot
```

Para guardar en nano, pulsa `Ctrl+O`, luego `Enter` y luego `Ctrl+X`. Después protege el archivo:

```bash
sudo chown root:root /etc/tkd-copilot.env
sudo chmod 600 /etc/tkd-copilot.env
```

El token GitHub Models debe tener permiso para usar el modelo seleccionado. Si no sabes qué modelo está habilitado, consulta con quien administra el token antes de cambiar `COPILOT_MODEL`. Esta clave permanece en la Pi; no se envía al navegador.

## 6. Instalar el servicio systemd

Abre el archivo de servicio:

```bash
sudo nano /etc/systemd/system/tkd-copilot.service
```

Pega el siguiente contenido. Antes de guardarlo, ejecuta `whoami` en SSH. Si el resultado no es `pi`, cambia `User=pi` y `Group=pi` por el nombre que te devolvió ese comando.

```ini
[Unit]
Description=TKD Global Hub Copilot SDK
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=admin
Group=admin
WorkingDirectory=/opt/tkd-copilot-service
EnvironmentFile=/etc/tkd-copilot.env
ExecStart=/usr/bin/node /opt/tkd-copilot-service/dist/server.js
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/tkd-copilot

[Install]
WantedBy=multi-user.target
```

Activa el servicio y revisa los logs:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now tkd-copilot
sudo systemctl status tkd-copilot --no-pager
sudo journalctl -u tkd-copilot -n 50 --no-pager
curl -fsS http://127.0.0.1:8080/health
```

El health check debe responder `{"status":"ok"}` y el servicio debe estar `active (running)`. El endpoint `/health` no requiere token ni muestra secretos. Si ves `failed`, no continúes: consulta el registro con el siguiente comando.

Si hay error, corrige la causa antes de continuar. Para seguir el log:

```bash
sudo journalctl -u tkd-copilot -f
```

## 7. Publicar HTTPS con Cloudflare Tunnel

No abras el puerto 8080 en el router ni publiques directamente la dirección IP de la Pi. El servicio escucha en la Pi; Cloudflare Tunnel crea una conexión saliente y un hostname HTTPS.

Instala `cloudflared` desde el repositorio oficial de Cloudflare (Debian/arm64):

```bash
sudo mkdir -p --mode=0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt-get update
sudo apt-get install -y cloudflared
cloudflared --version
```

Inicia sesión con Cloudflare. El comando imprimirá un enlace. Cópialo, ábrelo en el navegador de Windows e inicia sesión en Cloudflare para autorizar tu dominio:

```bash
cloudflared tunnel login
```

Crea el túnel y luego revisa el UUID largo que aparece:

```bash
cloudflared tunnel create tkd-copilot
cloudflared tunnel list
```

Reemplaza `copilot.tudominio.com` por el hostname real en todos los comandos y archivos. Por ejemplo, si tu dominio es `ejemplo.com`, podrías usar `copilot.ejemplo.com`. No escribas los signos `< >` que aparecen para marcar el UUID.

Crea el registro DNS que apunta al túnel:

```bash
cloudflared tunnel route dns tkd-copilot copilot.tudominio.com
```

`tunnel create` muestra el UUID del túnel y crea `~/.cloudflared/<UUID>.json`. Sustituye `<UUID>` por el valor mostrado, sin los signos `< >`, en los pasos siguientes.

Instala las credenciales del túnel y crea su configuración:

```bash
sudo install -d -m 0755 /etc/cloudflared
sudo install -m 0600 "$HOME/.cloudflared/<UUID>.json" /etc/cloudflared/<UUID>.json
sudo nano /etc/cloudflared/config.yml
```

Contenido de `/etc/cloudflared/config.yml`:

```yaml
tunnel: <UUID>
credentials-file: /etc/cloudflared/<UUID>.json
ingress:
  - hostname: copilot.tudominio.com
    service: http://127.0.0.1:8080
  - service: http_status:404
```

Pon el mismo hostname real en el comando `route dns`, en `config.yml` y en el último comando del siguiente bloque. Luego instala y arranca el servicio de Cloudflare:

```bash
sudo cloudflared service install
sudo systemctl enable --now cloudflared
sudo systemctl status cloudflared --no-pager
curl -fsS https://copilot.tudominio.com/health
```

El health check por HTTPS debe responder `{"status":"ok"}`. `/chat` exige `Authorization: Bearer <COPILOT_SERVICE_TOKEN>`; no desactives esa comprobación. Quien obtenga el token podría usar el endpoint, así que guárdalo como secreto de producción.

## 8. Configurar Vercel

Los siguientes comandos se ejecutan en PowerShell de Windows, no en la Pi. Ve a la carpeta web del proyecto:

```powershell
Set-Location C:\Users\angel\.gemini\antigravity-ide\scratch\tkd-platform\admin-panel
npx vercel login
npx vercel link
```

Sigue las preguntas que aparezcan en pantalla. Inicia sesión cuando Vercel abra el navegador. Cuando pregunte qué proyecto enlazar, selecciona el existente `tkdcore`. Si no aparece, cancela; no crees otro proyecto por error.

Añade la URL HTTPS del servicio:

```powershell
npx vercel env add COPILOT_SERVICE_URL production
```

Cuando Vercel pregunte por el valor, escribe el hostname real, por ejemplo `https://copilot.ejemplo.com` (sin `/chat`), y confirma que el entorno es `Production`.

Añade el mismo `COPILOT_SERVICE_TOKEN` que configuraste en `/etc/tkd-copilot.env`:

```powershell
npx vercel env add COPILOT_SERVICE_TOKEN production
```

Cuando Vercel pregunte por el valor, pega el mismo `COPILOT_SERVICE_TOKEN` que pusiste en `/etc/tkd-copilot.env`. Confirma `Production`. No lo pongas como argumento del comando ni en un archivo del repositorio.

La API también requiere `TKD_API_SECRET`, que ya utiliza el sistema actual de sesiones web. Comprueba que existe:

```powershell
npx vercel env ls production
```

Comprueba que la lista incluya `TKD_API_SECRET`. **No añadas otro valor ni lo reemplaces**: podría cerrar la sesión a los usuarios. Si no aparece, detente y pide ayuda al administrador técnico.

Las variables nuevas solo se aplican a despliegues nuevos. Despliega primero una vista previa:

```powershell
npx vercel
```

Abre la URL de vista previa que muestre Vercel e inicia sesión. Verifica el chat. Antes de publicar a producción, confirma que se van a subir únicamente los cambios aprobados:

```powershell
npx vercel --prod
```

No uses `git add .` como atajo si hay otros cambios en el repositorio. Si el proyecto se despliega desde GitHub, usa el flujo normal de pull request y promoción del deployment aprobado en lugar de publicar un directorio local no revisado.

## 9. Verificar la integración

1. Comprueba `https://copilot.tudominio.com/` (información del servicio), `https://copilot.tudominio.com/health` y `sudo systemctl status tkd-copilot cloudflared` por SSH.
2. Abre la URL de Preview o, tras el despliegue aprobado, `https://tkdcore.vercel.app/copilot` e inicia sesión como coach.
3. Selecciona un atleta de tu club y pregunta por una métrica presente en su historial. Comprueba que la respuesta no inventa datos.
4. Prueba con un atleta de otro club: la API debe rechazar el acceso.
5. Sin sesión, `POST /api/v1/ai/copilot` debe responder `401`; usuarios sin rol `COACH` o `ADMIN` deben recibir `403`.
6. Comprueba que propuestas del chat no se guardan, asignan ni publican: su publicación sigue pasando por AI Studio.
7. Mientras pruebas, monitoriza la Pi:

   ```bash
   free -h
   uptime
   vcgencmd measure_temp
   sudo journalctl -u tkd-copilot -f
   ```

8. Si aparece un reinicio por memoria o el servicio deja de responder, consulta `sudo journalctl -u tkd-copilot -n 100 --no-pager` y `sudo journalctl -k -n 100 --no-pager`. No habilites más concurrencia en la Zero 2.

## Actualizar el servicio más adelante

Compila una versión nueva en el PC, vuelve a crear y copiar el tarball de la sección 3. Por SSH:

```bash
sudo systemctl stop tkd-copilot
tar -xzf "$HOME/tkd-copilot-service.tgz" -C /opt/tkd-copilot-service
cd /opt/tkd-copilot-service
npm ci --omit=dev --no-audit --no-fund
sudo systemctl start tkd-copilot
sudo systemctl status tkd-copilot --no-pager
curl -fsS http://127.0.0.1:8080/health
```

## Límites y resolución básica

- Solo `ADMIN` y `COACH` pueden usar la ruta web; Vercel autoriza cada atleta antes de enviar datos.
- La Pi recibe solo el contexto deportivo necesario. No recibe la sesión web del usuario ni las credenciales de Supabase.
- `COPILOT_SERVICE_TOKEN` autentica las solicitudes entre Vercel y la Pi; `COPILOT_GITHUB_TOKEN` solo existe en la Pi.
- El servicio limita el cuerpo de cada solicitud y procesa una petición a la vez. Un servicio ocupado devuelve `429`.
- La ruta de Vercel espera hasta 50 segundos; el proceso de Copilot usa un timeout de 35 segundos para dejar margen de respuesta.
- Un `503` desde Vercel suele indicar variables sin configurar; un `502` indica que no se pudo completar la solicitud; `429` significa servicio ocupado o límite del proveedor.
- Si el hostname no responde, revisa DNS y `sudo systemctl status cloudflared`. Si `/health` local no responde, revisa `sudo systemctl status tkd-copilot` y sus logs.
