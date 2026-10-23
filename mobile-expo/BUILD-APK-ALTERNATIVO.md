# APK entrenador sin Expo Go ni EAS

La app se compila como Android nativo. Expo solo se usa para generar el proyecto nativo; la compilacion la realiza Gradle.

## GitHub Actions

1. Sube el repositorio a GitHub.
2. Abre `Actions` y ejecuta `Build trainer APK` con `Run workflow`.
3. Descarga el artefacto `tkd-coach-hub-apk`.
4. Instala `app-release.apk` en el dispositivo Android. Incluye el bundle JavaScript y no necesita Metro.

El workflow instala Java 17 y Android SDK automaticamente. No necesita Expo Go ni consume el cupo de EAS.

## Compilacion local

Requisitos:

- Android Studio con Android SDK Platform 35 y Build Tools 35.
- Java 17.
- `ANDROID_HOME` configurado.

Desde esta carpeta:

```powershell
$env:EXPO_PUBLIC_APP_VARIANT = "trainer"
npm ci
npx expo prebuild --platform android --no-install --non-interactive
npx tsc --noEmit
android\gradlew.bat assembleRelease --no-daemon
```

El APK queda en:

```text
android\app\build\outputs\apk\release\app-release.apk
```

El paquete Android del entrenador es `com.taekwondo.globalhub.trainer`, por lo que puede instalarse junto a la app atleta.
