# TKD Global Hub — Aplicación Móvil (Expo Go & APK)

Aplicación móvil oficial del **Ecosistema TKD Global Hub**, desarrollada con **React Native** y **Expo**, optimizada para ejecutarse inmediatamente con **Expo Go** y para compilarse en formato **APK de Android**.

---

## 📱 Características de la App

1. **Telemetría Cardíaca en Vivo (BLE)**:
   - Monitorización continua de pulsaciones (BPM) con animación de latido sincronizada.
   - Desglose en tiempo real de las 5 Zonas de Frecuencia Cardíaca WT (Z1 Recuperación a Z5 Anaeróbico láctico).
   - Cálculo del índice de estrés interno **TRIMP de Banister**.
   - Prueba de recuperación cardíaca a 60 segundos (**HRR**).
   - La pantalla permanece encendida mientras la app está en primer plano.

2. **Marcador Oficial de Combate WT (Simulador Daedo Gen 3 & KPNP)**:
   - Panel de combate oficial: **Chong (Azul)** vs **Hong (Rojo)**.
   - Contador de asaltos (R1, R2, R3) con temporizador oficial de 2 minutos.
   - Botones de puntuación oficial:
     - Puño cerrado (+1)
     - Patada al peto (+2)
     - Patada con giro al peto (+4)
     - Patada a la cabeza (+3)
     - Patada con giro a la cabeza (+5)
     - Penalizaciones (**Gam-Jeom**) que otorgan +1 punto directo al rival.
   - Indicador de asaltos ganados.

3. **Asistente Táctico con IA (Modelo v2.4 Adaptive)**:
   - Generación de recomendaciones tácticas personalizadas según nivel de fatiga.
   - 95.2% de precisión predictiva.
   - Sugerencia de microciclos semanales (sparring, potencia reactiva, recuperación activa).

4. **Ficha Biométrica del Atleta**:
   - Readiness Score (0-100%).
   - VO2 Máx estimado y FC de reposo.
   - Categorías oficiales World Taekwondo (-49kg, -58kg, -68kg, -80kg, etc.).
   - Historial de victorias / derrotas y técnica predilecta.
   - Sincronización en vivo con el backend Next.js desplegado en Vercel.

5. **Mi Club**:
   - Atletas: consulta de clases asignadas, cuotas propias, vídeos privados y logros habilitados.
   - Entrenadores y responsables de club: creación de clases compartidas y matrículas múltiples, registro/conciliación manual de cuotas, consulta de vídeos y administración de gamificación.
   - Administradores: acceso a la vista de club y selección explícita del club al crear movimientos o vídeos.
   - La API sigue aplicando los límites de plan y el aislamiento del club; un acceso denegado se muestra como error en la app y no se sustituye por datos de muestra.

6. **Tabata Timer**:
   - Apartado independiente con temporizador configurable de trabajo, descanso y rondas.
   - Incluye controles para iniciar, pausar, reanudar y reiniciar.
   - Configuración inicial: 20 segundos de trabajo, 10 segundos de descanso y 8 rondas.

7. **Historial de entrenamientos realizados**:
   - Los atletas consultan sus sesiones completadas.
   - Los entrenadores consultan las sesiones completadas de los atletas de su roster.

---

## 🚀 Cómo ejecutar en Expo Go (En 5 segundos)

1. Abre un terminal en la carpeta `mobile-expo`:
   ```bash
   cd mobile-expo
   npm start
   ```
2. Aparecerá un **código QR** en el terminal y se abrirá el navegador.
3. En tu teléfono móvil:
   - **Android**: Abre la app **Expo Go** (descárgala gratis de Google Play Store) y pulsa en **"Scan QR code"**.
   - **iPhone**: Abre la cámara nativa y escanea el código QR para abrir con Expo Go.
4. La aplicación cargará al instante en tu teléfono sin necesidad de compilar nada.

---

## 📦 Cómo generar el archivo APK para Android

Para generar un archivo **.apk** instalable en cualquier dispositivo Android sin pasar por Google Play Store:

### Opción A: Compilación en la Nube con EAS (Recomendada, no requiere Android Studio)

1. Instala EAS CLI globalmente (si no lo tienes):
   ```bash
   npm install -g eas-cli
   ```
2. Inicia sesión o crea una cuenta gratuita de Expo:
   ```bash
   npx eas login
   ```
3. Ejecuta el comando de generación de APK:
   ```bash
   npx eas build -p android --profile preview
   ```
   *El perfil `preview` está configurado en `eas.json` con `"buildType": "apk"`. Los servidores de Expo compilarán la app y te darán un enlace directo para descargar el archivo `.apk` a tu teléfono.*

Para generar la variante con herramientas de coach y administración:
```bash
npx eas build -p android --profile trainer
```
Ambos perfiles producen APK instalables. La versión actual es `2.1.3` (Android versionCode `10`).

### Opción B: Compilación Local (Requiere Android SDK y Java)

Si tienes Android Studio instalado en tu equipo:
```bash
npx eas build -p android --profile preview --local
```
Para generar un APK independiente con el bundle JavaScript integrado:
```bash
npx expo prebuild --platform android --no-install --non-interactive
cd android
gradlew.bat assembleRelease --no-daemon
```
El archivo queda en `android/app/build/outputs/apk/release/app-release.apk`. El firmado actual usa la clave de depuración del proyecto; es instalable para pruebas, pero no es una clave de publicación de Google Play.
