ALTER TABLE public.competition_tournaments
  ADD COLUMN IF NOT EXISTS tatami_count INTEGER NOT NULL DEFAULT 1;

NOTIFY pgrst, 'reload schema';
