-- Permite al administrador fijar un plan efectivo cuando sea necesario.
-- NULL significa que el plan efectivo vuelve a depender de Stripe.

ALTER TABLE public.club_subscriptions
    ADD COLUMN IF NOT EXISTS manual_plan_tier VARCHAR(20)
        CHECK (manual_plan_tier IN ('FREE', 'SEMIPRO', 'PRO'));

ALTER TABLE public.club_subscriptions
    ADD COLUMN IF NOT EXISTS manual_plan_set_at TIMESTAMP WITH TIME ZONE;

NOTIFY pgrst, 'reload schema';
