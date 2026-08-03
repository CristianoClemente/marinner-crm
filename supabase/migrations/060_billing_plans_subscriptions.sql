-- ============================================================
-- 060_billing_plans_subscriptions.sql
--
-- Mensalidades Marinner (Asaas Checkout RECURRENT):
--   plans, subscriptions (1:1 account), billing_events (idempotência)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  price_cents INT NOT NULL CHECK (price_cents >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'BRL',
  interval TEXT NOT NULL DEFAULT 'month'
    CHECK (interval IN ('month', 'year')),
  max_seats INT NOT NULL CHECK (max_seats > 0),
  max_contacts INT NULL,
  features JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.plans IS
  'Catálogo de planos SaaS Marinner (preços placeholder até fechamento comercial).';

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL UNIQUE REFERENCES public.accounts(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.plans(id),
  status TEXT NOT NULL DEFAULT 'incomplete'
    CHECK (status IN (
      'incomplete',
      'trialing',
      'active',
      'past_due',
      'canceled'
    )),
  asaas_customer_id TEXT NULL,
  asaas_subscription_id TEXT NULL,
  asaas_checkout_id TEXT NULL,
  external_reference TEXT NULL,
  trial_ends_at TIMESTAMPTZ NULL,
  current_period_start TIMESTAMPTZ NULL,
  current_period_end TIMESTAMPTZ NULL,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  billing_cpf_cnpj TEXT NULL,
  billing_phone TEXT NULL,
  billing_postal_code TEXT NULL,
  billing_address_number TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_status
  ON public.subscriptions (status);

CREATE INDEX IF NOT EXISTS idx_subscriptions_asaas_subscription
  ON public.subscriptions (asaas_subscription_id)
  WHERE asaas_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscriptions_asaas_checkout
  ON public.subscriptions (asaas_checkout_id)
  WHERE asaas_checkout_id IS NOT NULL;

COMMENT ON TABLE public.subscriptions IS
  'Assinatura corrente por account (Asaas). Writes via service role / webhooks.';

CREATE TABLE IF NOT EXISTS public.billing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asaas_event_id TEXT NOT NULL UNIQUE,
  event TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  subscription_id UUID NULL REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_events_event
  ON public.billing_events (event);

COMMENT ON TABLE public.billing_events IS
  'Idempotência de webhooks Asaas (at-least-once delivery).';

-- ------------------------------------------------------------
-- Seed planos (placeholder comercial)
-- ------------------------------------------------------------
INSERT INTO public.plans (
  code, name, price_cents, currency, interval, max_seats, max_contacts, features, sort_order
) VALUES
  (
    'starter',
    'Starter',
    19700,
    'BRL',
    'month',
    3,
    500,
    '{"broadcasts": true, "automations": false, "flows": false, "api_keys": false}'::jsonb,
    10
  ),
  (
    'pro',
    'Pro',
    39700,
    'BRL',
    'month',
    10,
    5000,
    '{"broadcasts": true, "automations": true, "flows": true, "api_keys": false}'::jsonb,
    20
  ),
  (
    'business',
    'Business',
    79700,
    'BRL',
    'month',
    25,
    NULL,
    '{"broadcasts": true, "automations": true, "flows": true, "api_keys": true}'::jsonb,
    30
  )
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  price_cents = EXCLUDED.price_cents,
  max_seats = EXCLUDED.max_seats,
  max_contacts = EXCLUDED.max_contacts,
  features = EXCLUDED.features,
  sort_order = EXCLUDED.sort_order,
  is_active = TRUE;

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read active plans" ON public.plans;
CREATE POLICY "Authenticated users can read active plans"
  ON public.plans FOR SELECT
  TO authenticated
  USING (is_active = TRUE);

DROP POLICY IF EXISTS "Members can read own subscription" ON public.subscriptions;
CREATE POLICY "Members can read own subscription"
  ON public.subscriptions FOR SELECT
  TO authenticated
  USING (is_account_member(account_id, 'viewer'));

-- billing_events: sem SELECT para authenticated (só service role / webhook)
DROP POLICY IF EXISTS "No direct member access to billing_events" ON public.billing_events;
-- intentional: no policies for authenticated → deny by default with RLS on

GRANT SELECT ON public.plans TO authenticated;
GRANT SELECT ON public.subscriptions TO authenticated;

-- Contas já existentes: assinatura Pro active sem Asaas (legado / dev)
INSERT INTO public.subscriptions (account_id, plan_id, status, external_reference)
SELECT a.id, p.id, 'active', a.id::text
FROM public.accounts a
CROSS JOIN public.plans p
WHERE p.code = 'pro'
  AND NOT EXISTS (
    SELECT 1 FROM public.subscriptions s WHERE s.account_id = a.id
  );
