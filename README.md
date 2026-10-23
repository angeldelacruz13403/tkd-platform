# 🥋 TKD Global Hub | Ecosistema Profesional de Taekwondo

Plataforma de alto rendimiento para Taekwondo olímpico y federativo que integra:
- **Panel de Administración Web Independiente**: Desarrollado en **Next.js 14**, **React**, **TypeScript** y **Tailwind CSS**.
- **Backend API REST**: 12 endpoints serverless preparados para **Vercel** con base de datos dual (SQLite local / PostgreSQL producción).
- **Subsistema de Inteligencia Artificial con Reentrenamiento Continuo**: Base de conocimiento RAG (reglamentos oficiales World Taekwondo, ejercicios, técnicas, vídeos) y calibración automática de pesos a partir de pulsaciones (Z1 a Z5), TRIMP y combates.
- **Aplicación Móvil Flutter**: Conexión Bluetooth Low Energy (BLE) a pulsómetros (Polar, Garmin) y marcador digital Daedo.

---

## 🚀 Inicio Rápido en Desarrollo Local

### 1. Panel de Administración & API REST
```bash
cd admin-panel
npm install
npm run dev
```
Abre en tu navegador: [http://localhost:3000](http://localhost:3000)

### 2. Probar la Compilación de Producción
```bash
npm run build
```

### 3. Aplicación Móvil Expo (Expo Go & APK)
```bash
cd mobile-expo
npm start          # Abre el código QR para escanear con la app Expo Go
npm run build:apk  # Genera el archivo APK instalable para Android con EAS
```

### 4. Aplicación Móvil Flutter (Alternativa)
```bash
cd mobile-app
flutter pub get
flutter run
```

---

## 📁 Estructura del Monorepo

```
tkd-platform/
├── admin-panel/                    # Next.js 14 App Router + Tailwind CSS
│   ├── app/
│   │   ├── (dashboard)/
│   │   │   ├── page.tsx           # Dashboard Principal & Marcador Daedo
│   │   │   ├── users/page.tsx     # 1. Gestión de Usuarios
│   │   │   ├── coaches/page.tsx   # 2. Gestión de Entrenadores
│   │   │   ├── athletes/page.tsx  # 3. Gestión de Atletas & Categorías WT
│   │   │   ├── clubs/page.tsx     # 4. Gestión de Clubes & Dojangs
│   │   │   ├── trainings/page.tsx # 5. Gestión de Entrenamientos & FC
│   │   │   ├── competitions/page.tsx # 6. Gestión de Competiciones
│   │   │   ├── ai-studio/page.tsx # 7. Gestión de IA & Reentrenamiento
│   │   │   ├── content/page.tsx   # 8. Gestión de Contenidos & Vídeos
│   │   │   ├── analytics/page.tsx # 9. Estadísticas Avanzadas (ACWR)
│   │   │   └── reports/page.tsx   # 10. Exportación de Informes
│   │   └── api/v1/                # 12 Endpoints REST para Web y Móvil
│   ├── components/                # Scoreboard Daedo, HeartRate visualizer, etc.
│   ├── lib/                       # Types, DB store reactivo, Motor de IA
│   └── vercel.json                # Configuración de despliegue en Vercel
├── mobile-app/                     # Aplicación Flutter en Dart
│   ├── lib/
│   │   ├── core/                  # Tema Taekwondo y Cliente REST HTTP
│   │   ├── services/              # Servicio BLE para pulsómetros (0x180D)
│   │   └── presentation/          # Pantallas (Home, Live Training, Daedo, Coach IA)
│   └── pubspec.yaml
└── deploy/                         # Guías de despliegue gratuito y migración
    ├── VERCEL_DEPLOY_GUIDE.md
    └── POSTGRES_MIGRATION.md
```

---

## 🛡️ Seguridad y Roles (RBAC)
- **ADMIN**: Control absoluto federativo, reentrenamiento de IA y auditorías.
- **COACH**: Planificación de entrenamientos, asignación de atletas y análisis de asaltos.
- **ATHLETE**: Visualización de pulsaciones en vivo, Readiness Score y plan adaptado.
- **CLUB**: Gestión de dojangs, licencias de instalaciones y deportistas afiliados.
