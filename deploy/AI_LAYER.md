# Capa de IA de entrenamiento

## Activación

1. Aplicar `ai-layer-migration.sql` en la misma base de Supabase que usa TKD Global Hub.
2. Configurar en el servidor `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` y uno de `GITHUB_MODELS_TOKEN` o `OPENAI_API_KEY`. La clave de servicio y las claves del proveedor nunca deben exponerse a las apps.
3. Para análisis de vídeo, configurar opcionalmente `GITHUB_VISION_MODEL` o `OPENAI_VISION_MODEL`. El despliegue Node debe incluir el binario compatible de `ffmpeg-static`.
4. Publicar el backend y probar las rutas con usuarios `ADMIN` o `COACH` asociados al atleta.

La migración crea tablas de análisis, planes y trabajos correctivos, además de un bucket de vídeo privado. Las tablas habilitan RLS y no conceden acceso directo a `anon`/`authenticated`; las rutas del servidor verifican la sesión y la relación con el atleta y acceden con la service role. No se deben crear políticas públicas para esos objetos.

## Flujos y API

- `POST /api/v1/ai/analyze-video`: requiere sesión de entrenador/administrador, `athleteId`, archivo de vídeo y `consent=true`; `competitionMatchId` es opcional. Los vídeos se guardan en `ai-combat-videos`. El muestreo visual produce evidencia con referencias temporales y sugerencias no aprobadas. Cuando se aporta un combate registrado, sus métricas oficiales se almacenan y presentan separadas de las observaciones visuales.
- `GET /api/v1/ai/plans?athleteId=...`: entrenadores autorizados ven los planes del atleta; el atleta solo ve planes `PUBLISHED`.
- `POST /api/v1/ai/plans`: crea un borrador semanal con contexto de sesiones recientes, carga registrada, disponibilidad fisiológica declarada y combates del atleta. La respuesta de IA se valida antes de persistir.
- `PATCH /api/v1/ai/plans`: las transiciones requieren intervención explícita del entrenador: borrador → revisión → aprobación → publicación. Los atletas no pueden aprobar ni modificar planes.
- `GET/POST/PATCH /api/v1/ai/corrective-work`: permite revisar propuestas, aprobar/rechazar y asignarlas a una fecha de un plan. Al asignar una propuesta, sus ejercicios se añaden a la sesión elegida. Los atletas solo ven trabajos asignados y pueden marcar inicio/completado.

Las apps cliente nunca reciben la URL privada ni las credenciales del proveedor. El análisis de vídeo no actualiza puntuaciones, ganadores o brackets; el avance automático de competición sigue siendo responsabilidad del flujo de resultados existente.

## Límites operativos

El análisis de vídeo se ejecuta actualmente de forma síncrona en Node, con límite de duración del endpoint de 60 segundos, tamaño máximo de 100 MB y duración máxima de vídeo de 30 minutos. Por tanto, el límite de duración del archivo no garantiza que cualquier vídeo pueda procesarse dentro del tiempo de ejecución serverless. Para uso sostenido o vídeos largos, mover extracción y análisis a una cola/worker y devolver un identificador de trabajo con estado; no aumentar el tiempo de espera sin confirmar los límites del proveedor de hosting.

La retención de vídeo debe definirse según la política de privacidad del club. La tabla deja `retention_until` preparado, pero aún no programa la eliminación automática de archivos. GitHub Models/OpenAI proporcionan inferencia por API; Copilot Studio y MCP no son dependencias del runtime de esta implementación y solo deberían añadirse si se requiere un agente de operaciones separado.
