-- Permite marcar a una cuenta COACH como director del club sin cambiar su rol.
-- No modifica registros existentes; todas las cuentas existentes quedan en FALSE.

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS is_club_director BOOLEAN NOT NULL DEFAULT FALSE;

NOTIFY pgrst, 'reload schema';
