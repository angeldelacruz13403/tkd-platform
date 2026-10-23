-- Persistencia de asistencia, licencias y exámenes del club.
-- Solo modifica el esquema; no inserta registros de negocio.

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
