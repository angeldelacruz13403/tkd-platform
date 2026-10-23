# 🚀 Guía de Despliegue: Supabase (PostgreSQL) + Vercel (API & Web) + App Móvil (APK)

Esta guía te permite dejar todo el ecosistema de **TKD Global Hub** en producción 100% funcional y gratuito, conectando la base de datos **Supabase**, el backend API en **Vercel** y la aplicación móvil **APK**.

---

## 📦 Arquitectura del Flujo en Producción

```
[ App Móvil Android (APK) ] 
        │
        ▼ (HTTPS REST API / CORS)
[ Vercel Serverless (Next.js 14) ]
   ├── Panel de Control Web:  https://tu-proyecto.vercel.app/
   └── Endpoints REST API:    https://tu-proyecto.vercel.app/api/v1/...
        │
        ▼ (@supabase/supabase-js)
[ Supabase Cloud (PostgreSQL) ]
   ├── Tabla Atletas, Combates, Entrenamientos, Usuarios
   └── Políticas de Seguridad RLS
```

---

## 🥋 PASO 1: Configurar Supabase (Base de Datos PostgreSQL)

1. Entra en [supabase.com](https://supabase.com) e inicia sesión (con tu cuenta de GitHub o Google).
2. Haz clic en **"New project"**:
   - **Name**: `tkd-global-hub`
   - **Database Password**: Genera o escribe una contraseña segura (guárdala).
   - **Region**: Elige la más cercana (ej: *Central EU (Frankfurt)* o *West US*).
   - Presiona **"Create new project"** (tarda ~1 minuto).
3. **Ejecutar el esquema único de datos**:
   - En el menú lateral izquierdo de Supabase, entra en **SQL Editor** (icono de terminal `>_`).
   - Haz clic en **"New query"**.
   - Abre el archivo local [`deploy/supabase-schema.sql`](file:///c:/Users/angel/.gemini/antigravity-ide/scratch/tkd-platform/deploy/supabase-schema.sql), copia todo su contenido, pégalo en el editor SQL de Supabase y pulsa **"Run"** (o Ctrl + Enter).
   - ✅ Verás el mensaje `Success. No rows returned`. Este esquema unificado crea/actualiza las tablas, índices y políticas RLS, incluidas las de torneos e inscripciones.
   - Los archivos `supabase-*-migration.sql` se conservan para instalaciones antiguas que necesiten aplicar solo cambios incrementales. En una instalación nueva o para reparar el esquema, ejecuta únicamente `supabase-schema.sql`.
4. **Obtener las credenciales**:
   - Ve a **Project Settings** (icono de engranaje abajo a la izquierda) -> **API**.
   - Copia los siguientes valores:
     - **Project URL**: Ejemplo `https://abcdefghijkl.supabase.co`
     - **Project API keys -> `anon` `public`**: Tu clave anónima.
     - **Project API keys -> `service_role` `secret`**: Tu clave con permisos completos de backend.

---

### Si aparece «Falta crear las tablas de torneos»

El esquema del proyecto incluye `competition_tournaments` y `competition_tournament_athletes`. Comprueba que ejecutaste el archivo completo en el mismo proyecto cuya URL está configurada en `SUPABASE_URL` en Vercel. El esquema solicita además la recarga de caché de PostgREST; espera unos segundos y vuelve a cargar la aplicación.

## ⚡ PASO 2: Desplegar en Vercel (Panel Web & API REST)

1. Entra en [vercel.com](https://vercel.com) e inicia sesión con GitHub.
2. Haz clic en **"Add New..."** -> **"Project"**.
3. Importa tu repositorio de GitHub de este proyecto:
   - En **Root Directory**, haz clic en *Edit* y selecciona la carpeta **`admin-panel`**.
   - **Framework Preset**: Detectará automáticamente **Next.js**.
4. **Configurar Variables de Entorno (Environment Variables)**:
   Despliega la sección *Environment Variables* y añade:

   | Nombre de Variable | Valor (Obtenido de Supabase) |
   | :--- | :--- |
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://tu-proyecto.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOi...` (clave anon) |
   | `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOi...` (clave service_role) |
   | `JWT_SECRET` | `tkd_secreto_super_seguro_produccion_2026` |
   | `NEXT_PUBLIC_APP_URL` | La URL que te asigne Vercel (o déjala temporalmente vacía) |

5. Haz clic en **"Deploy"**.
6. En unos 60 segundos tu proyecto estará vivo con:
   - **Dashboard Web**: `https://tu-proyecto.vercel.app`
   - **Endpoints REST**: `https://tu-proyecto.vercel.app/api/v1/athletes`, `/trainings`, `/ai/coach`, etc.

---

## 📱 PASO 3: Conectar la App Móvil (APK / Expo) con Vercel

Hemos configurado la aplicación móvil para que sea **completamente dinámica y compatible con Vercel**:

### Opción A: Desde la propia aplicación móvil (Sin recompilar)
1. Abre la aplicación en tu teléfono Android (o en Expo Go).
2. En la parte superior, debajo del logo, verás la pastilla verde **`Vercel API`**.
3. Toca sobre la pastilla para abrir el diálogo de configuración:
   - Introduce tu URL de Vercel con el sufijo `/api/v1`:  
     `https://tu-proyecto.vercel.app/api/v1`
   - Pulsa **"Guardar"**.
4. A partir de ese momento:
   - Al pulsar **"Generar Táctica Asalto 3"**, la app consultará en vivo el endpoint `/api/v1/ai/coach` desplegado en Vercel.
   - Las sesiones y telemetría de pulsaciones se enviarán a `/api/v1/trainings` y se registrarán directamente en **Supabase**.

### Opción B: Por defecto en el código
En el archivo `mobile-expo/api.ts` y en `mobile-expo/app.json`:
- Cambia `DEFAULT_VERCEL_API` con la URL definitiva que te dé Vercel.

---

## 🛡️ Verificación de Conectividad

Puedes comprobar que la API funciona desde cualquier navegador o terminal ejecutando:

```bash
# Probar endpoint de atletas
curl https://tu-proyecto.vercel.app/api/v1/athletes

# Probar recomendación táctica de IA
curl -X POST https://tu-proyecto.vercel.app/api/v1/ai/coach \
  -H "Content-Type: application/json" \
  -d '{"athleteId":"ath-1","round":3,"currentBpm":188}'
```

¡Todo el ecosistema queda listo para ser usado en entrenamientos y competiciones oficiales!
