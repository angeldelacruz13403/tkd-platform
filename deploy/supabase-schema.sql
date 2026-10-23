-- ==============================================================================
-- TKD GLOBAL HUB — ESQUEMA CANÓNICO COMPLETO PARA SUPABASE (POSTGRESQL)
-- ESQUEMA UNIFICADO v2.3 — INCLUYE TORNEOS, GESTIÓN DE CLUBES E IA; NO BORRA DATOS
-- ==============================================================================
-- Instrucciones:
-- 1. Ve a tu proyecto en https://supabase.com
-- 2. Entra en "SQL Editor" (icono de terminal en el menú lateral izquierdo)
-- 3. Pega todo este contenido y presiona "Run" (o Ctrl + Enter)
-- 4. Este es el único SQL necesario para crear/actualizar el esquema completo.
--    Incluye las migraciones incrementales del proyecto; es idempotente y no borra datos.
-- 5. Ejecútalo en el mismo proyecto Supabase configurado como SUPABASE_URL en Vercel.
-- ==============================================================================

-- ==============================================================================
-- EXTENSIONES
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 0. TABLA: CLUBS / DOJANGS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.clubs (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    dojang_address TEXT NOT NULL DEFAULT '',
    city VARCHAR(100) NOT NULL DEFAULT '',
    federation_code VARCHAR(50) NOT NULL DEFAULT '',
    director_name VARCHAR(255) NOT NULL DEFAULT '',
    athletes_count INTEGER DEFAULT 0,
    coaches_count INTEGER DEFAULT 0,
    active_subscriptions INTEGER DEFAULT 0,
    founded_year INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
CREATE UNIQUE INDEX IF NOT EXISTS clubs_federation_code_idx ON public.clubs(federation_code)
    WHERE federation_code IS NOT NULL AND federation_code <> '';

-- ==============================================================================
-- 1. TABLA: USUARIOS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.users (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    username VARCHAR(100),
    password TEXT NOT NULL DEFAULT '',
    dni VARCHAR(30),
    role VARCHAR(20) NOT NULL CHECK (role IN ('ADMIN', 'COACH', 'ATHLETE', 'CLUB')),
    is_club_director BOOLEAN NOT NULL DEFAULT FALSE,
    avatar_url TEXT,
    phone VARCHAR(50),
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PENDING', 'SUSPENDED')),
    club_id VARCHAR(50) REFERENCES public.clubs(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Compatibilidad con instalaciones anteriores
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS username VARCHAR(100);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS dni VARCHAR(30);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_club_director BOOLEAN NOT NULL DEFAULT FALSE;
CREATE UNIQUE INDEX IF NOT EXISTS users_username_idx ON public.users(username) WHERE username IS NOT NULL;
CREATE INDEX IF NOT EXISTS users_role_idx ON public.users(role);
CREATE INDEX IF NOT EXISTS users_club_idx ON public.users(club_id);

-- ==============================================================================
-- 2. TABLA: ENTRENADORES (COACHES)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.coaches (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) REFERENCES public.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    dan_grade VARCHAR(50) NOT NULL DEFAULT '',
    specialty VARCHAR(100) NOT NULL DEFAULT 'COMBAT_KYORUGI',
    license_number VARCHAR(50) NOT NULL DEFAULT '',
    club_id VARCHAR(50) REFERENCES public.clubs(id) ON DELETE SET NULL,
    club_name VARCHAR(255) DEFAULT '',
    assigned_athletes_count INTEGER DEFAULT 0,
    experience_years INTEGER DEFAULT 0,
    email VARCHAR(255) NOT NULL DEFAULT '',
    certifications TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.coaches ADD COLUMN IF NOT EXISTS club_name VARCHAR(255) DEFAULT '';
ALTER TABLE public.coaches ADD COLUMN IF NOT EXISTS certifications TEXT[] DEFAULT '{}';
CREATE UNIQUE INDEX IF NOT EXISTS coaches_license_idx ON public.coaches(license_number)
    WHERE license_number IS NOT NULL AND license_number <> '';
CREATE INDEX IF NOT EXISTS coaches_user_id_idx ON public.coaches(user_id);
CREATE INDEX IF NOT EXISTS coaches_club_id_idx ON public.coaches(club_id);

-- ==============================================================================
-- 3. TABLA: ATLETAS (ATHLETES)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.athletes (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) REFERENCES public.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    gender VARCHAR(10) NOT NULL DEFAULT 'M' CHECK (gender IN ('M', 'F')),
    wt_category VARCHAR(50) NOT NULL DEFAULT 'SENIOR_M_68',
    belt VARCHAR(50) NOT NULL DEFAULT '1st_Dan',
    coach_id VARCHAR(50) REFERENCES public.coaches(id) ON DELETE SET NULL,
    coach_name VARCHAR(255) DEFAULT '',
    club_id VARCHAR(50) REFERENCES public.clubs(id) ON DELETE SET NULL,
    club_name VARCHAR(255) DEFAULT '',
    weight NUMERIC(5, 2) NOT NULL DEFAULT 0,
    height NUMERIC(5, 2) NOT NULL DEFAULT 0,
    vo2max NUMERIC(5, 2) DEFAULT 0,
    max_bpm INTEGER DEFAULT 200,
    rest_bpm INTEGER DEFAULT 50,
    readiness_score INTEGER DEFAULT 90 CHECK (readiness_score BETWEEN 0 AND 100),
    injury_status VARCHAR(20) DEFAULT 'FIT' CHECK (injury_status IN ('FIT', 'MINOR_STRAIN', 'RECOVERING')),
    favourite_kick VARCHAR(100),
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    ko_tko_count INTEGER DEFAULT 0,
    gamjeom_avg NUMERIC(4,2) DEFAULT 0.0,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.athletes ADD COLUMN IF NOT EXISTS coach_name VARCHAR(255) DEFAULT '';
ALTER TABLE public.athletes ADD COLUMN IF NOT EXISTS club_name VARCHAR(255) DEFAULT '';
ALTER TABLE public.athletes ADD COLUMN IF NOT EXISTS injury_status VARCHAR(20) DEFAULT 'FIT';
ALTER TABLE public.athletes ADD COLUMN IF NOT EXISTS ko_tko_count INTEGER DEFAULT 0;
ALTER TABLE public.athletes ADD COLUMN IF NOT EXISTS gamjeom_avg NUMERIC(4,2) DEFAULT 0.0;
-- Todas las fichas son alumnos; is_competitor marca el subconjunto habilitado para competir.
ALTER TABLE public.athletes ADD COLUMN IF NOT EXISTS is_competitor BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS athletes_user_id_idx ON public.athletes(user_id);
CREATE INDEX IF NOT EXISTS athletes_coach_id_idx ON public.athletes(coach_id);
CREATE INDEX IF NOT EXISTS athletes_club_id_idx ON public.athletes(club_id);
CREATE INDEX IF NOT EXISTS athletes_wt_category_idx ON public.athletes(wt_category);
CREATE INDEX IF NOT EXISTS athletes_competitor_idx ON public.athletes(club_id, is_competitor);

-- ==============================================================================
-- 4. TABLA: SESIONES DE ENTRENAMIENTO & TELEMETRÍA CARDÍACA
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.training_sessions (
    id VARCHAR(50) PRIMARY KEY,
    athlete_id VARCHAR(50) REFERENCES public.athletes(id) ON DELETE CASCADE,
    coach_id VARCHAR(50) REFERENCES public.coaches(id) ON DELETE SET NULL,
    title VARCHAR(255) DEFAULT 'Sesión de Entrenamiento',
    date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    session_type VARCHAR(60) NOT NULL DEFAULT 'SPARRING_DAEDO',
    duration_minutes INTEGER NOT NULL DEFAULT 0,
    avg_bpm INTEGER NOT NULL DEFAULT 0,
    max_bpm INTEGER NOT NULL DEFAULT 0,
    trimp_score NUMERIC(8, 2) NOT NULL DEFAULT 0,
    hrr_1_min INTEGER DEFAULT 0,
    rpe_score NUMERIC(3, 1) DEFAULT 0,
    zone1_minutes NUMERIC(5, 2) DEFAULT 0,
    zone2_minutes NUMERIC(5, 2) DEFAULT 0,
    zone3_minutes NUMERIC(5, 2) DEFAULT 0,
    zone4_minutes NUMERIC(5, 2) DEFAULT 0,
    zone5_minutes NUMERIC(5, 2) DEFAULT 0,
    tactical_notes TEXT,
    status VARCHAR(20) DEFAULT 'COMPLETED',
    bpm_series JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Compatibilidad con instalaciones anteriores
ALTER TABLE public.training_sessions ADD COLUMN IF NOT EXISTS title VARCHAR(255) DEFAULT 'Sesión de Entrenamiento';
ALTER TABLE public.training_sessions ADD COLUMN IF NOT EXISTS hrr_1_min INTEGER DEFAULT 0;
ALTER TABLE public.training_sessions ADD COLUMN IF NOT EXISTS rpe_score NUMERIC(3,1) DEFAULT 0;
ALTER TABLE public.training_sessions ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'COMPLETED';
ALTER TABLE public.training_sessions ADD COLUMN IF NOT EXISTS bpm_series JSONB DEFAULT '[]'::jsonb;
CREATE INDEX IF NOT EXISTS training_sessions_athlete_idx ON public.training_sessions(athlete_id);
CREATE INDEX IF NOT EXISTS training_sessions_coach_idx ON public.training_sessions(coach_id);
CREATE INDEX IF NOT EXISTS training_sessions_date_idx ON public.training_sessions(date DESC);
CREATE INDEX IF NOT EXISTS training_sessions_status_idx ON public.training_sessions(status);

-- ==============================================================================
-- 5. TABLA: TELEMETRÍA EN VIVO (PPM tiempo real)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.athlete_live_telemetry (
    athlete_id VARCHAR(50) PRIMARY KEY,  -- Sin FK: permite que la PECA transmita sin registro previo
    athlete_name VARCHAR(255) NOT NULL DEFAULT '',
    category VARCHAR(50),
    belt_rank VARCHAR(50),
    club_id VARCHAR(50),
    coach_id VARCHAR(50),
    current_bpm INTEGER NOT NULL DEFAULT 0,
    max_bpm INTEGER NOT NULL DEFAULT 200,
    resting_bpm INTEGER DEFAULT 50,
    zone VARCHAR(2) NOT NULL DEFAULT 'Z1',
    zone_name VARCHAR(80) NOT NULL DEFAULT 'En espera',
    zone_color VARCHAR(16) NOT NULL DEFAULT '#64748b',
    trimp_score NUMERIC(10, 2) DEFAULT 0,
    session_duration_sec INTEGER DEFAULT 0,
    training_mode VARCHAR(50) DEFAULT 'standby',
    is_running BOOLEAN NOT NULL DEFAULT FALSE,
    battery_level INTEGER,
    status VARCHAR(10) NOT NULL DEFAULT 'OFFLINE' CHECK (status IN ('LIVE', 'PAUSED', 'OFFLINE')),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
-- CORRECCIÓN: zone_color faltaba en instalaciones anteriores
ALTER TABLE public.athlete_live_telemetry ADD COLUMN IF NOT EXISTS zone_color VARCHAR(16) NOT NULL DEFAULT '#64748b';
-- CORRECCIÓN: Eliminar FK constraint para permitir que la PECA transmita sin atleta registrado previamente
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'athlete_live_telemetry'
    AND constraint_type = 'FOREIGN KEY'
    AND constraint_name = 'athlete_live_telemetry_athlete_id_fkey'
  ) THEN
    ALTER TABLE public.athlete_live_telemetry DROP CONSTRAINT athlete_live_telemetry_athlete_id_fkey;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS athlete_live_telemetry_club_idx ON public.athlete_live_telemetry(club_id);
CREATE INDEX IF NOT EXISTS athlete_live_telemetry_coach_idx ON public.athlete_live_telemetry(coach_id);
CREATE INDEX IF NOT EXISTS athlete_live_telemetry_status_idx ON public.athlete_live_telemetry(status);
CREATE INDEX IF NOT EXISTS athlete_live_telemetry_updated_idx ON public.athlete_live_telemetry(updated_at DESC);

-- ==============================================================================
-- 6. TABLA: SESIÓN ACTIVA (control de entrenamientos IN_PROGRESS)
--    Una fila por atleta mientras entrena. Se borra al finalizar.
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.active_training_sessions (
    athlete_id VARCHAR(50) PRIMARY KEY REFERENCES public.athletes(id) ON DELETE CASCADE,
    session_id VARCHAR(50) NOT NULL,
    coach_id VARCHAR(50) REFERENCES public.coaches(id) ON DELETE SET NULL,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    training_mode VARCHAR(50) DEFAULT 'combate',
    bpm_series JSONB DEFAULT '[]'::jsonb,
    last_bpm INTEGER DEFAULT 0,
    max_bpm_recorded INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
ALTER TABLE public.active_training_sessions ADD COLUMN IF NOT EXISTS training_mode VARCHAR(50) DEFAULT 'combate';
ALTER TABLE public.active_training_sessions ADD COLUMN IF NOT EXISTS bpm_series JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.active_training_sessions ADD COLUMN IF NOT EXISTS last_bpm INTEGER DEFAULT 0;
ALTER TABLE public.active_training_sessions ADD COLUMN IF NOT EXISTS max_bpm_recorded INTEGER DEFAULT 0;
CREATE INDEX IF NOT EXISTS active_training_sessions_coach_idx ON public.active_training_sessions(coach_id);

-- ==============================================================================
-- 7. TABLA: COMBATES Y ASALTOS (COMPETITION MATCHES)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.competition_matches (
    id VARCHAR(50) PRIMARY KEY,
    competition_name VARCHAR(255) NOT NULL DEFAULT '',
    tournament_id VARCHAR(50),
    date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    category VARCHAR(50) NOT NULL DEFAULT 'SENIOR_M_68',
    chong_athlete_id VARCHAR(50) REFERENCES public.athletes(id) ON DELETE SET NULL,
    chong_name VARCHAR(255) DEFAULT '',
    hong_athlete_id VARCHAR(50) REFERENCES public.athletes(id) ON DELETE SET NULL,
    hong_athlete_name VARCHAR(255) NOT NULL DEFAULT '',
    hong_country VARCHAR(10),
    chong_score INTEGER DEFAULT 0,
    hong_score INTEGER DEFAULT 0,
    chong_gamjeom INTEGER DEFAULT 0,
    hong_gamjeom INTEGER DEFAULT 0,
    winner VARCHAR(10) CHECK (winner IN ('CHONG', 'HONG', 'PENDING')),
    head_kicks INTEGER DEFAULT 0,
    spinning_head INTEGER DEFAULT 0,
    body_kicks INTEGER DEFAULT 0,
    spinning_body INTEGER DEFAULT 0,
    punches INTEGER DEFAULT 0,
    round1_result VARCHAR(50),
    round2_result VARCHAR(50),
    round3_result VARCHAR(50),
    stamina_drop_round3 BOOLEAN DEFAULT FALSE,
    match_number VARCHAR(30) DEFAULT '',
    phase VARCHAR(50) DEFAULT '',
    system_type VARCHAR(50),
    started BOOLEAN DEFAULT FALSE,
    last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.competition_matches ADD COLUMN IF NOT EXISTS tournament_id VARCHAR(50);
ALTER TABLE public.competition_matches ADD COLUMN IF NOT EXISTS chong_name VARCHAR(255) DEFAULT '';
ALTER TABLE public.competition_matches ADD COLUMN IF NOT EXISTS hong_athlete_id VARCHAR(50);
ALTER TABLE public.competition_matches ADD COLUMN IF NOT EXISTS head_kicks INTEGER DEFAULT 0;
ALTER TABLE public.competition_matches ADD COLUMN IF NOT EXISTS spinning_head INTEGER DEFAULT 0;
ALTER TABLE public.competition_matches ADD COLUMN IF NOT EXISTS body_kicks INTEGER DEFAULT 0;
ALTER TABLE public.competition_matches ADD COLUMN IF NOT EXISTS spinning_body INTEGER DEFAULT 0;
ALTER TABLE public.competition_matches ADD COLUMN IF NOT EXISTS punches INTEGER DEFAULT 0;
ALTER TABLE public.competition_matches ADD COLUMN IF NOT EXISTS stamina_drop_round3 BOOLEAN DEFAULT FALSE;
ALTER TABLE public.competition_matches ADD COLUMN IF NOT EXISTS match_number VARCHAR(30) DEFAULT '';
ALTER TABLE public.competition_matches ADD COLUMN IF NOT EXISTS phase VARCHAR(50) DEFAULT '';
ALTER TABLE public.competition_matches ADD COLUMN IF NOT EXISTS started BOOLEAN DEFAULT FALSE;
ALTER TABLE public.competition_matches ADD COLUMN IF NOT EXISTS last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE public.competition_matches ADD COLUMN IF NOT EXISTS match_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS competition_matches_tournament_idx ON public.competition_matches(tournament_id);
CREATE INDEX IF NOT EXISTS competition_matches_chong_idx ON public.competition_matches(chong_athlete_id);
CREATE INDEX IF NOT EXISTS competition_matches_date_idx ON public.competition_matches(date DESC);

-- ==============================================================================
-- 8. TABLA: MARCADOR DAEDO EN VIVO
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.daedo_live_matches (
    match_id VARCHAR(100) PRIMARY KEY,
    mat VARCHAR(20) NOT NULL DEFAULT 'A',
    tournament_name VARCHAR(255) DEFAULT '',
    chong_name VARCHAR(255) DEFAULT '',
    hong_name VARCHAR(255) DEFAULT '',
    chong_score INTEGER DEFAULT 0,
    hong_score INTEGER DEFAULT 0,
    chong_gamjeom INTEGER DEFAULT 0,
    hong_gamjeom INTEGER DEFAULT 0,
    round INTEGER DEFAULT 1,
    seconds_left INTEGER DEFAULT 0,
    clock_running BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'READY',
    last_event_type VARCHAR(20) DEFAULT 'UNKNOWN',
    last_event_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    raw_encoding VARCHAR(10),
    raw_value TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS daedo_live_mat_idx ON public.daedo_live_matches(mat);

-- ==============================================================================
-- 9. TABLA: TORNEOS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.competition_tournaments (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    date TIMESTAMP WITH TIME ZONE,
    venue VARCHAR(255),
    category VARCHAR(50),
    tatami_number INTEGER NOT NULL DEFAULT 1,
    club_id VARCHAR(50) REFERENCES public.clubs(id) ON DELETE CASCADE,
    registered_athletes JSONB NOT NULL DEFAULT '[]'::jsonb,
    status VARCHAR(20) DEFAULT 'UPCOMING' CHECK (status IN ('UPCOMING', 'IN_PROGRESS', 'FINISHED', 'CANCELLED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.competition_tournaments ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'UPCOMING';
ALTER TABLE public.competition_tournaments ADD COLUMN IF NOT EXISTS tatami_number INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.competition_tournaments ADD COLUMN IF NOT EXISTS club_id VARCHAR(50) REFERENCES public.clubs(id) ON DELETE CASCADE;
ALTER TABLE public.competition_tournaments ADD COLUMN IF NOT EXISTS name VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE public.competition_tournaments ADD COLUMN IF NOT EXISTS date TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.competition_tournaments ADD COLUMN IF NOT EXISTS venue VARCHAR(255);
ALTER TABLE public.competition_tournaments ADD COLUMN IF NOT EXISTS category VARCHAR(50);
ALTER TABLE public.competition_tournaments ADD COLUMN IF NOT EXISTS registered_athletes JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.competition_tournaments ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
CREATE INDEX IF NOT EXISTS competition_tournaments_club_idx ON public.competition_tournaments(club_id);

CREATE TABLE IF NOT EXISTS public.competition_tournament_athletes (
    tournament_id VARCHAR(50) NOT NULL REFERENCES public.competition_tournaments(id) ON DELETE CASCADE,
    athlete_id VARCHAR(50) NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
    club_id VARCHAR(50) REFERENCES public.clubs(id) ON DELETE SET NULL,
    registration_status VARCHAR(20) NOT NULL DEFAULT 'REGISTERED' CHECK (registration_status IN ('REGISTERED', 'WITHDRAWN', 'CONFIRMED')),
    registered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tournament_id, athlete_id)
);
ALTER TABLE public.competition_tournament_athletes ADD COLUMN IF NOT EXISTS club_id VARCHAR(50) REFERENCES public.clubs(id) ON DELETE SET NULL;
ALTER TABLE public.competition_tournament_athletes ADD COLUMN IF NOT EXISTS registration_status VARCHAR(20) NOT NULL DEFAULT 'REGISTERED';
ALTER TABLE public.competition_tournament_athletes ADD COLUMN IF NOT EXISTS registered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW();

-- Repara inscripciones antiguas guardadas solo en JSON y habilita sus fichas para competir.
INSERT INTO public.competition_tournament_athletes (tournament_id, athlete_id, club_id)
SELECT tournament.id, athlete.id, athlete.club_id
FROM public.competition_tournaments AS tournament
CROSS JOIN LATERAL jsonb_array_elements(
    CASE
        WHEN jsonb_typeof(tournament.registered_athletes) = 'array' THEN tournament.registered_athletes
        ELSE '[]'::jsonb
    END
) AS registration(entry)
JOIN public.athletes AS athlete
    ON athlete.id = COALESCE(
        NULLIF(registration.entry ->> 'athleteId', ''),
        NULLIF(registration.entry ->> 'id', '')
    )
ON CONFLICT (tournament_id, athlete_id) DO NOTHING;

UPDATE public.athletes AS athlete
SET is_competitor = TRUE
WHERE athlete.is_competitor = FALSE
  AND EXISTS (
      SELECT 1
      FROM public.competition_tournament_athletes AS registration
      WHERE registration.athlete_id = athlete.id
        AND registration.registration_status <> 'WITHDRAWN'
  );

CREATE INDEX IF NOT EXISTS competition_tournament_athletes_athlete_idx ON public.competition_tournament_athletes(athlete_id);
CREATE INDEX IF NOT EXISTS competition_tournament_athletes_tournament_idx ON public.competition_tournament_athletes(tournament_id);

-- ==============================================================================
-- 10. TABLA: BASE DE CONOCIMIENTO IA (RAG)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.ai_knowledge (
    id VARCHAR(50) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN (
        'EXERCISE', 'WT_RULES', 'TECHNIQUE', 'VIDEO_DRILL',
        'PHYSIOLOGY_PDF', 'RULEBOOK', 'TACTICS', 'COMBAT_CASE'
    )),
    description TEXT NOT NULL DEFAULT '',
    file_type VARCHAR(50) DEFAULT 'DOCUMENT_MD',
    file_url TEXT,
    source_file_name VARCHAR(255),
    source_file_size INTEGER DEFAULT 0,
    source_mime_type VARCHAR(100),
    tags TEXT[] DEFAULT '{}',
    indexed_tokens INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'INDEXED' CHECK (status IN ('INDEXED', 'PROCESSING', 'NEEDS_REVIEW')),
    added_by VARCHAR(255) DEFAULT 'System Admin',
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.ai_knowledge ADD COLUMN IF NOT EXISTS source_file_name VARCHAR(255);
ALTER TABLE public.ai_knowledge ADD COLUMN IF NOT EXISTS source_file_size INTEGER DEFAULT 0;
ALTER TABLE public.ai_knowledge ADD COLUMN IF NOT EXISTS source_mime_type VARCHAR(100);
CREATE INDEX IF NOT EXISTS ai_knowledge_category_idx ON public.ai_knowledge(category);

-- ==============================================================================
-- 11. TABLA: MÉTRICAS DE REENTRENAMIENTO IA
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.retrain_metrics (
    id SERIAL PRIMARY KEY,
    model_version VARCHAR(50) NOT NULL,
    trained_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    dataset_size_records INTEGER NOT NULL DEFAULT 0,
    heart_rate_sessions_analyzed INTEGER NOT NULL DEFAULT 0,
    combat_rounds_processed INTEGER NOT NULL DEFAULT 0,
    fatigue_prediction_accuracy NUMERIC(5, 2) NOT NULL DEFAULT 0,
    tactical_recommendation_f1 NUMERIC(5, 2) NOT NULL DEFAULT 0,
    learned_weights JSONB NOT NULL DEFAULT '{}'::jsonb,
    changelog TEXT,
    is_active BOOLEAN DEFAULT TRUE
);

-- ==============================================================================
-- 12. TABLA: DISPOSITIVOS PECA / BLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.peca_devices (
    device_id VARCHAR(100) PRIMARY KEY,
    athlete_id VARCHAR(50) REFERENCES public.athletes(id) ON DELETE SET NULL,
    device_name VARCHAR(100) DEFAULT 'PECA Sensor',
    firmware_version VARCHAR(30),
    battery_level INTEGER,
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.peca_devices ADD COLUMN IF NOT EXISTS firmware_version VARCHAR(30);
ALTER TABLE public.peca_devices ADD COLUMN IF NOT EXISTS battery_level INTEGER;
CREATE INDEX IF NOT EXISTS peca_devices_athlete_idx ON public.peca_devices(athlete_id);

-- ==============================================================================
-- 13. PRIVACIDAD Y TRAZABILIDAD (RGPD / LOPDGDD)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.privacy_consents (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    purpose VARCHAR(100) NOT NULL,
    policy_version VARCHAR(30) NOT NULL,
    granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMP WITH TIME ZONE,
    source VARCHAR(30) NOT NULL DEFAULT 'WEB'
);

CREATE TABLE IF NOT EXISTS public.audit_log (
    id BIGSERIAL PRIMARY KEY,
    actor_user_id VARCHAR(50) REFERENCES public.users(id) ON DELETE SET NULL,
    action VARCHAR(80) NOT NULL,
    resource_type VARCHAR(80) NOT NULL,
    resource_id VARCHAR(80),
    occurred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS audit_log_actor_idx ON public.audit_log(actor_user_id);
CREATE INDEX IF NOT EXISTS audit_log_resource_idx ON public.audit_log(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS audit_log_occurred_idx ON public.audit_log(occurred_at DESC);

-- ==============================================================================
-- 14. FUNCIÓN: Actualizar updated_at automáticamente (trigger helper)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS athlete_live_telemetry_updated_at ON public.athlete_live_telemetry;
CREATE TRIGGER athlete_live_telemetry_updated_at
    BEFORE UPDATE ON public.athlete_live_telemetry
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS active_training_sessions_updated_at ON public.active_training_sessions;
CREATE TRIGGER active_training_sessions_updated_at
    BEFORE UPDATE ON public.active_training_sessions
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS daedo_live_matches_updated_at ON public.daedo_live_matches;
CREATE TRIGGER daedo_live_matches_updated_at
    BEFORE UPDATE ON public.daedo_live_matches
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ==============================================================================
-- 15. POLÍTICAS DE ACCESO (ROW LEVEL SECURITY)
-- ==============================================================================
ALTER TABLE public.clubs                            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users                            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaches                          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.athletes                         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_sessions                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.active_training_sessions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.athlete_live_telemetry           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_matches              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daedo_live_matches               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_knowledge                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retrain_metrics                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_tournaments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_tournament_athletes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.peca_devices                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.privacy_consents                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log                        ENABLE ROW LEVEL SECURITY;

-- CLUBS
DROP POLICY IF EXISTS "Permitir lectura publica de clubs" ON public.clubs;
DROP POLICY IF EXISTS "Permitir servicio gestionar clubs" ON public.clubs;
CREATE POLICY "Permitir lectura publica de clubs" ON public.clubs FOR SELECT USING (false);
CREATE POLICY "Permitir servicio gestionar clubs" ON public.clubs FOR ALL USING (false) WITH CHECK (false);

-- USERS
DROP POLICY IF EXISTS "Permitir lectura publica de usuarios" ON public.users;
DROP POLICY IF EXISTS "Permitir servicio gestionar usuarios" ON public.users;
CREATE POLICY "Permitir lectura publica de usuarios" ON public.users FOR SELECT USING (false);
CREATE POLICY "Permitir servicio gestionar usuarios" ON public.users FOR ALL USING (false) WITH CHECK (false);

-- COACHES
DROP POLICY IF EXISTS "Permitir lectura publica de coaches" ON public.coaches;
DROP POLICY IF EXISTS "Permitir servicio gestionar coaches" ON public.coaches;
CREATE POLICY "Permitir lectura publica de coaches" ON public.coaches FOR SELECT USING (false);
CREATE POLICY "Permitir servicio gestionar coaches" ON public.coaches FOR ALL USING (false) WITH CHECK (false);

-- ATHLETES
DROP POLICY IF EXISTS "Permitir lectura publica de atletas" ON public.athletes;
DROP POLICY IF EXISTS "Permitir servicio gestionar atletas" ON public.athletes;
CREATE POLICY "Permitir lectura publica de atletas" ON public.athletes FOR SELECT USING (false);
CREATE POLICY "Permitir servicio gestionar atletas" ON public.athletes FOR ALL USING (false) WITH CHECK (false);

-- TRAINING SESSIONS
DROP POLICY IF EXISTS "Permitir lectura publica de entrenamientos" ON public.training_sessions;
DROP POLICY IF EXISTS "Permitir insertar entrenamientos" ON public.training_sessions;
DROP POLICY IF EXISTS "Permitir servicio gestionar entrenamientos" ON public.training_sessions;
CREATE POLICY "Permitir lectura publica de entrenamientos" ON public.training_sessions FOR SELECT USING (false);
CREATE POLICY "Permitir insertar entrenamientos" ON public.training_sessions FOR INSERT WITH CHECK (false);
CREATE POLICY "Permitir servicio gestionar entrenamientos" ON public.training_sessions FOR ALL USING (false) WITH CHECK (false);

-- ACTIVE TRAINING SESSIONS
DROP POLICY IF EXISTS "active_training_sessions_all" ON public.active_training_sessions;
CREATE POLICY "active_training_sessions_all" ON public.active_training_sessions FOR ALL USING (false) WITH CHECK (false);

-- ATHLETE LIVE TELEMETRY
DROP POLICY IF EXISTS "Permitir lectura telemetria atleta" ON public.athlete_live_telemetry;
DROP POLICY IF EXISTS "Permitir servicio gestionar telemetria" ON public.athlete_live_telemetry;
CREATE POLICY "Permitir lectura telemetria atleta" ON public.athlete_live_telemetry FOR SELECT USING (false);
CREATE POLICY "Permitir servicio gestionar telemetria" ON public.athlete_live_telemetry FOR ALL USING (false) WITH CHECK (false);

-- COMPETITION MATCHES
DROP POLICY IF EXISTS "Permitir lectura publica de combates" ON public.competition_matches;
DROP POLICY IF EXISTS "Permitir servicio gestionar combates" ON public.competition_matches;
CREATE POLICY "Permitir lectura publica de combates" ON public.competition_matches FOR SELECT USING (false);
CREATE POLICY "Permitir servicio gestionar combates" ON public.competition_matches FOR ALL USING (false) WITH CHECK (false);

-- DAEDO LIVE
DROP POLICY IF EXISTS "Permitir lectura publica marcador vivo" ON public.daedo_live_matches;
DROP POLICY IF EXISTS "Permitir servicio gestionar marcador vivo" ON public.daedo_live_matches;
CREATE POLICY "Permitir lectura publica marcador vivo" ON public.daedo_live_matches FOR SELECT USING (false);
CREATE POLICY "Permitir servicio gestionar marcador vivo" ON public.daedo_live_matches FOR ALL USING (false) WITH CHECK (false);

-- TOURNAMENTS
DROP POLICY IF EXISTS "Permitir lectura publica de torneos" ON public.competition_tournaments;
DROP POLICY IF EXISTS "Permitir servicio gestionar torneos" ON public.competition_tournaments;
CREATE POLICY "Permitir lectura publica de torneos" ON public.competition_tournaments FOR SELECT USING (false);
CREATE POLICY "Permitir servicio gestionar torneos" ON public.competition_tournaments FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Permitir lectura publica de inscritos" ON public.competition_tournament_athletes;
DROP POLICY IF EXISTS "Permitir servicio gestionar inscritos" ON public.competition_tournament_athletes;
CREATE POLICY "Permitir lectura publica de inscritos" ON public.competition_tournament_athletes FOR SELECT USING (false);
CREATE POLICY "Permitir servicio gestionar inscritos" ON public.competition_tournament_athletes FOR ALL USING (false) WITH CHECK (false);

-- AI KNOWLEDGE
DROP POLICY IF EXISTS "Permitir lectura publica de base de conocimiento" ON public.ai_knowledge;
DROP POLICY IF EXISTS "Permitir servicio gestionar base de conocimiento" ON public.ai_knowledge;
CREATE POLICY "Permitir lectura publica de base de conocimiento" ON public.ai_knowledge FOR SELECT USING (false);
CREATE POLICY "Permitir servicio gestionar base de conocimiento" ON public.ai_knowledge FOR ALL USING (false) WITH CHECK (false);

-- RETRAIN METRICS
DROP POLICY IF EXISTS "Permitir lectura publica de metricas IA" ON public.retrain_metrics;
DROP POLICY IF EXISTS "Permitir servicio gestionar metricas IA" ON public.retrain_metrics;
CREATE POLICY "Permitir lectura publica de metricas IA" ON public.retrain_metrics FOR SELECT USING (false);
CREATE POLICY "Permitir servicio gestionar metricas IA" ON public.retrain_metrics FOR ALL USING (false) WITH CHECK (false);

-- PECA DEVICES
DROP POLICY IF EXISTS "peca_devices_all" ON public.peca_devices;
CREATE POLICY "peca_devices_all" ON public.peca_devices FOR ALL USING (false) WITH CHECK (false);

-- PRIVACY & AUDIT — bloqueados a Anon Key, solo accesibles via Service Role Key
DROP POLICY IF EXISTS "Permitir servicio gestionar consentimientos" ON public.privacy_consents;
CREATE POLICY "Permitir servicio gestionar consentimientos" ON public.privacy_consents FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Permitir servicio gestionar auditoria" ON public.audit_log;
CREATE POLICY "Permitir servicio gestionar auditoria" ON public.audit_log FOR ALL USING (false) WITH CHECK (false);

-- ==============================================================================
-- 16. CAPA DE IA: ANÁLISIS DE VÍDEO, PLANES Y TRABAJOS CORRECTIVOS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.ai_video_analyses (
    id VARCHAR(50) PRIMARY KEY,
    athlete_id VARCHAR(50) NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
    competition_match_id VARCHAR(50) REFERENCES public.competition_matches(id) ON DELETE SET NULL,
    created_by VARCHAR(50) REFERENCES public.users(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'QUEUED'
        CHECK (status IN ('QUEUED', 'PROCESSING', 'COMPLETED', 'NEEDS_REVIEW', 'APPROVED', 'FAILED')),
    storage_bucket VARCHAR(100) NOT NULL,
    storage_path TEXT NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes > 0),
    duration_seconds NUMERIC(10, 2),
    provider VARCHAR(100),
    model VARCHAR(100),
    result JSONB NOT NULL DEFAULT '{}'::jsonb
        CHECK (jsonb_typeof(result) = 'object'),
    error_message TEXT,
    consent_recorded_at TIMESTAMP WITH TIME ZONE,
    retention_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_video_analyses_athlete_created_idx
    ON public.ai_video_analyses(athlete_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_video_analyses_match_idx
    ON public.ai_video_analyses(competition_match_id);
CREATE INDEX IF NOT EXISTS ai_video_analyses_status_idx
    ON public.ai_video_analyses(status, created_at);

CREATE TABLE IF NOT EXISTS public.ai_training_plans (
    id VARCHAR(50) PRIMARY KEY,
    athlete_id VARCHAR(50) NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
    coach_id VARCHAR(50) REFERENCES public.coaches(id) ON DELETE SET NULL,
    created_by VARCHAR(50) REFERENCES public.users(id) ON DELETE SET NULL,
    week_start DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED')),
    objective TEXT NOT NULL,
    periodization_phase VARCHAR(50) NOT NULL DEFAULT 'GENERAL',
    context_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb
        CHECK (jsonb_typeof(context_snapshot) = 'object'),
    plan JSONB NOT NULL CHECK (jsonb_typeof(plan) = 'object'),
    provider VARCHAR(100),
    model VARCHAR(100),
    prompt_version VARCHAR(50) NOT NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    published_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_training_plans_athlete_week_idx
    ON public.ai_training_plans(athlete_id, week_start DESC);
CREATE INDEX IF NOT EXISTS ai_training_plans_coach_status_idx
    ON public.ai_training_plans(coach_id, status, week_start DESC);

CREATE TABLE IF NOT EXISTS public.ai_corrective_work (
    id VARCHAR(50) PRIMARY KEY,
    athlete_id VARCHAR(50) NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
    video_analysis_id VARCHAR(50) REFERENCES public.ai_video_analyses(id) ON DELETE SET NULL,
    training_plan_id VARCHAR(50) REFERENCES public.ai_training_plans(id) ON DELETE SET NULL,
    training_session_id VARCHAR(50) REFERENCES public.training_sessions(id) ON DELETE SET NULL,
    planned_session_date DATE,
    created_by VARCHAR(50) REFERENCES public.users(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PROPOSED'
        CHECK (status IN ('PROPOSED', 'APPROVED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED')),
    optional BOOLEAN NOT NULL DEFAULT FALSE,
    title VARCHAR(255) NOT NULL,
    objective TEXT NOT NULL,
    rationale TEXT NOT NULL DEFAULT '',
    exercises JSONB NOT NULL DEFAULT '[]'::jsonb
        CHECK (jsonb_typeof(exercises) = 'array'),
    source_evidence JSONB NOT NULL DEFAULT '[]'::jsonb
        CHECK (jsonb_typeof(source_evidence) = 'array'),
    athlete_feedback TEXT,
    coach_notes TEXT,
    due_date DATE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_corrective_work_athlete_status_idx
    ON public.ai_corrective_work(athlete_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_corrective_work_plan_idx
    ON public.ai_corrective_work(training_plan_id);
CREATE INDEX IF NOT EXISTS ai_corrective_work_session_idx
    ON public.ai_corrective_work(training_session_id);
CREATE INDEX IF NOT EXISTS ai_corrective_work_analysis_idx
    ON public.ai_corrective_work(video_analysis_id);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'ai-combat-videos',
    'ai-combat-videos',
    FALSE,
    104857600,
    ARRAY['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska']
)
ON CONFLICT (id) DO UPDATE SET
    public = FALSE,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Las escrituras de estas tablas se realizan desde el servidor con service_role.
-- Sin políticas permisivas adicionales, anon/authenticated no tienen acceso directo.
ALTER TABLE public.ai_video_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_training_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_corrective_work ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- SISTEMA LISTO — SIN BORRAR DATOS EXISTENTES
-- Panel Admin:  https://tkdcore.vercel.app
-- Supabase:     https://supabase.com/dashboard
-- ==============================================================================
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- 17. PLANES DE CLUB, CLASES, FINANZAS Y GAMIFICACIÓN
-- ==============================================================================
ALTER TABLE public.athletes ADD COLUMN IF NOT EXISTS date_of_birth DATE;

CREATE TABLE IF NOT EXISTS public.club_subscriptions (
    club_id VARCHAR(50) PRIMARY KEY REFERENCES public.clubs(id) ON DELETE CASCADE,
    plan_tier VARCHAR(20) NOT NULL DEFAULT 'FREE'
        CHECK (plan_tier IN ('FREE', 'SEMIPRO', 'PRO')),
    manual_plan_tier VARCHAR(20)
        CHECK (manual_plan_tier IN ('FREE', 'SEMIPRO', 'PRO')),
    manual_plan_set_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELED')),
    billing_interval VARCHAR(10)
        CHECK (billing_interval IN ('MONTH', 'YEAR')),
    stripe_customer_id VARCHAR(100),
    stripe_subscription_id VARCHAR(100) UNIQUE,
    stripe_schedule_id VARCHAR(100),
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    trial_ends_at TIMESTAMP WITH TIME ZONE,
    grace_ends_at TIMESTAMP WITH TIME ZONE,
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
    pending_plan_tier VARCHAR(20)
        CHECK (pending_plan_tier IN ('FREE', 'SEMIPRO', 'PRO')),
    pending_billing_interval VARCHAR(10)
        CHECK (pending_billing_interval IN ('MONTH', 'YEAR')),
    trial_used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
ALTER TABLE public.club_subscriptions ADD COLUMN IF NOT EXISTS manual_plan_tier VARCHAR(20)
    CHECK (manual_plan_tier IN ('FREE', 'SEMIPRO', 'PRO'));
ALTER TABLE public.club_subscriptions ADD COLUMN IF NOT EXISTS manual_plan_set_at TIMESTAMP WITH TIME ZONE;
CREATE INDEX IF NOT EXISTS club_subscriptions_customer_idx
    ON public.club_subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS club_subscriptions_status_period_idx
    ON public.club_subscriptions(status, current_period_end);

CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
    event_id VARCHAR(100) PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.club_classes (
    id VARCHAR(50) PRIMARY KEY,
    club_id VARCHAR(50) NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    coach_id VARCHAR(50) REFERENCES public.coaches(id) ON DELETE SET NULL,
    name VARCHAR(160) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (club_id, name)
);
CREATE INDEX IF NOT EXISTS club_classes_club_active_idx
    ON public.club_classes(club_id, is_active);
CREATE INDEX IF NOT EXISTS club_classes_coach_idx ON public.club_classes(coach_id);

CREATE TABLE IF NOT EXISTS public.club_class_athletes (
    class_id VARCHAR(50) NOT NULL REFERENCES public.club_classes(id) ON DELETE CASCADE,
    athlete_id VARCHAR(50) NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (class_id, athlete_id)
);
CREATE INDEX IF NOT EXISTS club_class_athletes_athlete_idx
    ON public.club_class_athletes(athlete_id);

CREATE TABLE IF NOT EXISTS public.class_training_sessions (
    id VARCHAR(50) PRIMARY KEY,
    class_id VARCHAR(50) NOT NULL REFERENCES public.club_classes(id) ON DELETE CASCADE,
    coach_id VARCHAR(50) REFERENCES public.coaches(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_minutes INTEGER NOT NULL CHECK (duration_minutes BETWEEN 1 AND 1440),
    session_type VARCHAR(60) NOT NULL DEFAULT 'SPARRING_TACTICAL',
    notes TEXT NOT NULL DEFAULT '',
    blocks JSONB NOT NULL DEFAULT '[]'::jsonb
        CHECK (jsonb_typeof(blocks) = 'array'),
    status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED'
        CHECK (status IN ('SCHEDULED', 'COMPLETED', 'CANCELLED')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS class_training_sessions_class_date_idx
    ON public.class_training_sessions(class_id, scheduled_at DESC);

CREATE TABLE IF NOT EXISTS public.coach_shared_videos (
    id VARCHAR(50) PRIMARY KEY,
    club_id VARCHAR(50) NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    coach_user_id VARCHAR(50) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    storage_path TEXT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes > 0),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    archived_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS coach_shared_videos_club_created_idx
    ON public.coach_shared_videos(club_id, created_at DESC)
    WHERE archived_at IS NULL;

CREATE TABLE IF NOT EXISTS public.club_finance_entries (
    id VARCHAR(50) PRIMARY KEY,
    club_id VARCHAR(50) NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    athlete_id VARCHAR(50) REFERENCES public.athletes(id) ON DELETE SET NULL,
    entry_type VARCHAR(24) NOT NULL
        CHECK (entry_type IN ('STUDENT_DUE', 'INCOME', 'EXPENSE')),
    status VARCHAR(20) NOT NULL DEFAULT 'PAID'
        CHECK (status IN ('PENDING', 'PAID', 'CANCELLED')),
    description VARCHAR(255) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
    due_date DATE,
    occurred_at DATE NOT NULL DEFAULT CURRENT_DATE,
    paid_at TIMESTAMP WITH TIME ZONE,
    payment_method VARCHAR(20)
        CHECK (payment_method IN ('CASH', 'CARD', 'TRANSFER', 'BIZUM', 'DIRECT_DEBIT')),
    created_by VARCHAR(50) REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CHECK (entry_type <> 'STUDENT_DUE' OR athlete_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS club_finance_entries_club_date_idx
    ON public.club_finance_entries(club_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS club_finance_entries_athlete_status_idx
    ON public.club_finance_entries(athlete_id, status, due_date);

CREATE TABLE IF NOT EXISTS public.gamification_achievements (
    id VARCHAR(50) PRIMARY KEY,
    club_id VARCHAR(50) REFERENCES public.clubs(id) ON DELETE CASCADE,
    title VARCHAR(120) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    icon VARCHAR(80) NOT NULL DEFAULT 'star',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by VARCHAR(50) REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (club_id, title)
);
CREATE INDEX IF NOT EXISTS gamification_achievements_club_active_idx
    ON public.gamification_achievements(club_id, is_active);

CREATE TABLE IF NOT EXISTS public.gamification_levels (
    level_number INTEGER PRIMARY KEY CHECK (level_number > 0),
    name VARCHAR(100) NOT NULL,
    required_achievements INTEGER NOT NULL CHECK (required_achievements >= 0),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.athlete_gamification (
    athlete_id VARCHAR(50) PRIMARY KEY REFERENCES public.athletes(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    updated_by VARCHAR(50) REFERENCES public.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.athlete_achievements (
    athlete_id VARCHAR(50) NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
    achievement_id VARCHAR(50) NOT NULL REFERENCES public.gamification_achievements(id) ON DELETE CASCADE,
    awarded_by VARCHAR(50) REFERENCES public.users(id) ON DELETE SET NULL,
    awarded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    note TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (athlete_id, achievement_id)
);
CREATE INDEX IF NOT EXISTS athlete_achievements_achievement_idx
    ON public.athlete_achievements(achievement_id, awarded_at DESC);

CREATE TABLE IF NOT EXISTS public.athlete_guardian_consents (
    id VARCHAR(50) PRIMARY KEY,
    athlete_id VARCHAR(50) NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
    club_id VARCHAR(50) NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    guardian_name VARCHAR(255) NOT NULL,
    guardian_email VARCHAR(255) NOT NULL,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'GRANTED', 'REVOKED', 'EXPIRED')),
    policy_version VARCHAR(30) NOT NULL,
    requested_by VARCHAR(50) REFERENCES public.users(id) ON DELETE SET NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    granted_at TIMESTAMP WITH TIME ZONE,
    consent_expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
ALTER TABLE public.athlete_guardian_consents
    ADD COLUMN IF NOT EXISTS consent_expires_at TIMESTAMP WITH TIME ZONE;
UPDATE public.athlete_guardian_consents
SET consent_expires_at = granted_at + INTERVAL '1 year'
WHERE status = 'GRANTED'
  AND consent_expires_at IS NULL
  AND granted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS athlete_guardian_consents_athlete_idx
    ON public.athlete_guardian_consents(athlete_id, status);

-- Coach videos are stored privately and only streamed through club-scoped API routes.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'coach-shared-videos',
    'coach-shared-videos',
    FALSE,
    104857600,
    ARRAY['video/mp4', 'video/quicktime', 'video/webm']
)
ON CONFLICT (id) DO UPDATE SET
    public = FALSE,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

ALTER TABLE public.club_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_class_athletes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_shared_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_finance_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamification_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamification_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.athlete_gamification ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.athlete_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.athlete_guardian_consents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "server_only_club_subscriptions" ON public.club_subscriptions;
CREATE POLICY "server_only_club_subscriptions" ON public.club_subscriptions
    FOR ALL USING (FALSE) WITH CHECK (FALSE);
DROP POLICY IF EXISTS "server_only_stripe_webhook_events" ON public.stripe_webhook_events;
CREATE POLICY "server_only_stripe_webhook_events" ON public.stripe_webhook_events
    FOR ALL USING (FALSE) WITH CHECK (FALSE);
DROP POLICY IF EXISTS "server_only_club_classes" ON public.club_classes;
CREATE POLICY "server_only_club_classes" ON public.club_classes
    FOR ALL USING (FALSE) WITH CHECK (FALSE);
DROP POLICY IF EXISTS "server_only_club_class_athletes" ON public.club_class_athletes;
CREATE POLICY "server_only_club_class_athletes" ON public.club_class_athletes
    FOR ALL USING (FALSE) WITH CHECK (FALSE);
DROP POLICY IF EXISTS "server_only_class_training_sessions" ON public.class_training_sessions;
CREATE POLICY "server_only_class_training_sessions" ON public.class_training_sessions
    FOR ALL USING (FALSE) WITH CHECK (FALSE);
DROP POLICY IF EXISTS "server_only_coach_shared_videos" ON public.coach_shared_videos;
CREATE POLICY "server_only_coach_shared_videos" ON public.coach_shared_videos
    FOR ALL USING (FALSE) WITH CHECK (FALSE);
DROP POLICY IF EXISTS "server_only_club_finance_entries" ON public.club_finance_entries;
CREATE POLICY "server_only_club_finance_entries" ON public.club_finance_entries
    FOR ALL USING (FALSE) WITH CHECK (FALSE);
DROP POLICY IF EXISTS "server_only_gamification_achievements" ON public.gamification_achievements;
CREATE POLICY "server_only_gamification_achievements" ON public.gamification_achievements
    FOR ALL USING (FALSE) WITH CHECK (FALSE);
DROP POLICY IF EXISTS "server_only_gamification_levels" ON public.gamification_levels;
CREATE POLICY "server_only_gamification_levels" ON public.gamification_levels
    FOR ALL USING (FALSE) WITH CHECK (FALSE);
DROP POLICY IF EXISTS "server_only_athlete_gamification" ON public.athlete_gamification;
CREATE POLICY "server_only_athlete_gamification" ON public.athlete_gamification
    FOR ALL USING (FALSE) WITH CHECK (FALSE);
DROP POLICY IF EXISTS "server_only_athlete_achievements" ON public.athlete_achievements;
CREATE POLICY "server_only_athlete_achievements" ON public.athlete_achievements
    FOR ALL USING (FALSE) WITH CHECK (FALSE);
DROP POLICY IF EXISTS "server_only_athlete_guardian_consents" ON public.athlete_guardian_consents;
CREATE POLICY "server_only_athlete_guardian_consents" ON public.athlete_guardian_consents
    FOR ALL USING (FALSE) WITH CHECK (FALSE);

NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- 18. REGISTROS REALES DE ASISTENCIA, LICENCIAS Y EXÁMENES
-- No se insertan registros de ejemplo.
-- ==============================================================================
ALTER TABLE public.club_finance_entries
    ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20)
        CHECK (payment_method IN ('CASH', 'CARD', 'TRANSFER', 'BIZUM', 'DIRECT_DEBIT'));

CREATE TABLE IF NOT EXISTS public.club_attendance_records (
    id VARCHAR(50) PRIMARY KEY,
    club_id VARCHAR(50) NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    athlete_id VARCHAR(50) NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    group_name VARCHAR(160) NOT NULL DEFAULT 'Sin grupo',
    status VARCHAR(20) NOT NULL
        CHECK (status IN ('PRESENT', 'ABSENT', 'JUSTIFIED', 'LATE')),
    check_in_time TIME,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (athlete_id, attendance_date)
);
CREATE INDEX IF NOT EXISTS club_attendance_records_club_date_idx
    ON public.club_attendance_records(club_id, attendance_date);
CREATE INDEX IF NOT EXISTS club_attendance_records_athlete_date_idx
    ON public.club_attendance_records(athlete_id, attendance_date DESC);

CREATE TABLE IF NOT EXISTS public.club_member_licenses (
    id VARCHAR(50) PRIMARY KEY,
    club_id VARCHAR(50) NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    athlete_id VARCHAR(50) NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
    category VARCHAR(50),
    federation_code VARCHAR(50) NOT NULL,
    federation_region VARCHAR(255) NOT NULL,
    license_expiry_date DATE NOT NULL,
    insurance_policy VARCHAR(255) NOT NULL,
    insurance_valid_until DATE NOT NULL,
    medical_clearance_date DATE NOT NULL,
    medical_clearance_valid_until DATE NOT NULL,
    minor_consent_signed BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'EXPIRING_SOON', 'EXPIRED', 'PENDING_RENEWAL')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS club_member_licenses_club_expiry_idx
    ON public.club_member_licenses(club_id, license_expiry_date);
CREATE INDEX IF NOT EXISTS club_member_licenses_athlete_idx
    ON public.club_member_licenses(athlete_id);

CREATE TABLE IF NOT EXISTS public.belt_exam_events (
    id VARCHAR(50) PRIMARY KEY,
    club_id VARCHAR(50) NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    exam_date DATE NOT NULL,
    examiner_name VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN'
        CHECK (status IN ('OPEN', 'IN_PROGRESS', 'COMPLETED')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS belt_exam_events_club_date_idx
    ON public.belt_exam_events(club_id, exam_date DESC);

CREATE TABLE IF NOT EXISTS public.belt_exam_candidates (
    exam_id VARCHAR(50) NOT NULL REFERENCES public.belt_exam_events(id) ON DELETE CASCADE,
    athlete_id VARCHAR(50) NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
    current_belt VARCHAR(50) NOT NULL,
    target_belt VARCHAR(100) NOT NULL,
    attended_classes INTEGER NOT NULL DEFAULT 0 CHECK (attended_classes >= 0),
    min_classes_required INTEGER NOT NULL DEFAULT 40 CHECK (min_classes_required >= 0),
    poomsae_score NUMERIC(3, 1) CHECK (poomsae_score BETWEEN 0 AND 10),
    sparring_score NUMERIC(3, 1) CHECK (sparring_score BETWEEN 0 AND 10),
    technique_score NUMERIC(3, 1) CHECK (technique_score BETWEEN 0 AND 10),
    breaking_score NUMERIC(3, 1) CHECK (breaking_score BETWEEN 0 AND 10),
    passed BOOLEAN,
    fee_paid BOOLEAN NOT NULL DEFAULT FALSE,
    diploma_issued BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (exam_id, athlete_id)
);
CREATE INDEX IF NOT EXISTS belt_exam_candidates_athlete_idx
    ON public.belt_exam_candidates(athlete_id);

ALTER TABLE public.club_attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_member_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.belt_exam_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.belt_exam_candidates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "server_only_club_attendance_records" ON public.club_attendance_records;
CREATE POLICY "server_only_club_attendance_records" ON public.club_attendance_records
    FOR ALL USING (FALSE) WITH CHECK (FALSE);
DROP POLICY IF EXISTS "server_only_club_member_licenses" ON public.club_member_licenses;
CREATE POLICY "server_only_club_member_licenses" ON public.club_member_licenses
    FOR ALL USING (FALSE) WITH CHECK (FALSE);
DROP POLICY IF EXISTS "server_only_belt_exam_events" ON public.belt_exam_events;
CREATE POLICY "server_only_belt_exam_events" ON public.belt_exam_events
    FOR ALL USING (FALSE) WITH CHECK (FALSE);
DROP POLICY IF EXISTS "server_only_belt_exam_candidates" ON public.belt_exam_candidates;
CREATE POLICY "server_only_belt_exam_candidates" ON public.belt_exam_candidates
    FOR ALL USING (FALSE) WITH CHECK (FALSE);

NOTIFY pgrst, 'reload schema';
