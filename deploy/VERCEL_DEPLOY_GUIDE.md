# Guía de Despliegue 100% Gratuito en Vercel

Esta guía detalla los pasos para desplegar el **Panel de Administración Web y Backend API REST de Taekwondo** en **Vercel** sin coste alguno, aprovechando los niveles gratuitos (*Hobby Tiers*) de Vercel y bases de datos PostgreSQL serverless.

---

## 1. Arquitectura de Despliegue Gratuito

| Componente | Proveedor Gratuito | Especificaciones Gratis |
|---|---|---|
| **Frontend & API REST** | Vercel (Hobby Tier) | Ancho de banda ilimitado, Serverless Edge Functions, HTTPS automático, CDN global |
| **Base de Datos Producción** | Neon.tech / Supabase Free | 500 MB almacenamiento, conexiones seguras pooled con SSL, backups automáticos |
| **Almacenamiento Media** | Supabase Storage / Cloudinary | 1 GB de vídeos y PDFs gratuitos |
| **Modelo de IA** | Motor Heurístico Local + Gemini Flash Free Tier | Inferencia sin coste de servidores dedicados |

---

## 2. Preparación de la Base de Datos PostgreSQL Gratuita

1. Regístrate gratuitamente en [Neon.tech](https://neon.tech) o [Supabase](https://supabase.com).
2. Crea un proyecto llamado `tkd-ecosystem-prod`.
3. Copia la cadena de conexión (*Connection String*). Ejemplo de Neon:
   ```env
   DATABASE_URL="postgresql://usuario:contraseña@ep-tkd-123456.us-east-2.aws.neon.tech/neondb?sslmode=require"
   ```

---

## 3. Despliegue en Vercel en 3 Pasos

### Paso A: Subir el Proyecto a GitHub / GitLab
```bash
git init
git add .
git commit -m "Ecosistema profesional de Taekwondo con IA y telemetría"
git branch -M main
git remote add origin https://github.com/tu-usuario/tkd-platform.git
git push -u origin main
```

### Paso B: Conectar con Vercel
1. Inicia sesión en [Vercel](https://vercel.com).
2. Haz clic en **Add New... -> Project**.
3. Importa el repositorio de GitHub.
4. En **Root Directory**, selecciona la carpeta `admin-panel` (o deja raíz si configuras Monorepo).
5. En **Build and Output Settings**:
   - Framework Preset: `Next.js`
   - Build Command: `npm run build`
   - Output Directory: `.next`

### Paso C: Variables de Entorno en Vercel
En la sección **Environment Variables** de Vercel, añade:
- `DATABASE_URL`: Tu URL de PostgreSQL de Neon/Supabase.
- `JWT_SECRET`: Una clave segura aleatoria para autenticación.
- `NEXT_PUBLIC_APP_URL`: La URL pública que te asigne Vercel (ej. `https://tkd-hub.vercel.app`).
- `GEMINI_API_KEY` (Opcional): Tu API Key gratuita de Google AI Studio.

Haz clic en **Deploy**. ¡Tu plataforma estará online en menos de 2 minutos con certificado SSL y CDN mundial!

---

## 4. Inicialización de Datos en Producción
Una vez desplegado en Vercel, ejecuta la semilla inicial de datos en tu base de datos PostgreSQL:
```bash
npm run prisma:db:push
npm run prisma:seed
```
Esto creará automáticamente las tablas con los atletas, categorías WT, reglamentos de arbitraje y datos de telemetría de muestra.
