-- Esquema de gestión del club para instalaciones que ya tienen el esquema base.
-- No inserta clubes, suscripciones, clases, alumnos ni otros registros de negocio.

ALTER TABLE public.athletes
    ADD COLUMN IF NOT EXISTS date_of_birth DATE;

CREATE TABLE IF NOT EXISTS public.club_subscriptions (
    club_id VARCHAR(50) PRIMARY KEY REFERENCES public.clubs(id) ON DELETE CASCADE,
    plan_tier VARCHAR(20) NOT NULL DEFAULT 'FREE'
        CHECK (plan_tier IN ('FREE', 'SEMIPRO', 'PRO')),
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
CREATE INDEX IF NOT EXISTS club_classes_coach_idx
    ON public.club_classes(coach_id);

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
CREATE INDEX IF NOT EXISTS athlete_guardian_consents_athlete_idx
    ON public.athlete_guardian_consents(athlete_id, status);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'coach-shared-videos',
    'coach-shared-videos',
    FALSE,
    104857600,
    ARRAY['video/mp4', 'video/quicktime', 'video/webm']
)
ON CONFLICT (id) DO NOTHING;

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
