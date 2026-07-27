-- ============================================================
-- 040_whatsapp_config_provider_zapi
--
-- Adiciona suporte multi-provider (Meta Cloud API | Z-API) em
-- whatsapp_config. Uma conta continua com no máximo uma config
-- (UNIQUE account_id). O provider é exclusivo: meta OU zapi.
--
-- Mudanças:
--   1. Coluna `provider` ('meta' | 'zapi'), default 'meta'
--   2. Colunas Z-API (tokens criptografados no app, como access_token)
--   3. phone_number_id / access_token passam a ser nullable
--      (obrigatórios só quando provider = 'meta', via CHECK)
--   4. UNIQUE parcial em zapi_instance_id para lookup no webhook
--
-- Backfill: linhas existentes recebem provider = 'meta' e
-- continuam válidas (já têm phone_number_id + access_token).
--
-- Idempotente — safe to re-run.
-- ============================================================

-- 1. Provider + colunas Z-API
ALTER TABLE whatsapp_config
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'meta',
  ADD COLUMN IF NOT EXISTS zapi_instance_id TEXT,
  ADD COLUMN IF NOT EXISTS zapi_instance_token TEXT,
  ADD COLUMN IF NOT EXISTS zapi_client_token TEXT;

-- 2. Restringir valores de provider (guard via pg_constraint —
--    PostgreSQL não tem ADD CONSTRAINT IF NOT EXISTS).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'whatsapp_config_provider_check'
      AND conrelid = 'whatsapp_config'::regclass
  ) THEN
    ALTER TABLE whatsapp_config
      ADD CONSTRAINT whatsapp_config_provider_check
      CHECK (provider IN ('meta', 'zapi'));
  END IF;
END $$;

-- 3. Campos Meta deixam de ser NOT NULL — a coerência fica no CHECK
--    por provider (abaixo). Linhas Meta existentes já têm valores.
ALTER TABLE whatsapp_config
  ALTER COLUMN phone_number_id DROP NOT NULL,
  ALTER COLUMN access_token DROP NOT NULL;

-- 4. Coerência por provider: Meta exige phone_number_id + access_token;
--    Z-API exige instance id + tokens. Impede estado híbrido inválido.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'whatsapp_config_provider_credentials_check'
      AND conrelid = 'whatsapp_config'::regclass
  ) THEN
    ALTER TABLE whatsapp_config
      DROP CONSTRAINT whatsapp_config_provider_credentials_check;
  END IF;

  ALTER TABLE whatsapp_config
    ADD CONSTRAINT whatsapp_config_provider_credentials_check
    CHECK (
      (
        provider = 'meta'
        AND phone_number_id IS NOT NULL
        AND access_token IS NOT NULL
      )
      OR
      (
        provider = 'zapi'
        AND zapi_instance_id IS NOT NULL
        AND zapi_instance_token IS NOT NULL
        AND zapi_client_token IS NOT NULL
      )
    );
END $$;

-- 5. Lookup do webhook Z-API por instance id (uma instância → uma conta).
--    UNIQUE parcial: múltiplos NULL (provider meta) são permitidos.
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_config_zapi_instance_id
  ON whatsapp_config (zapi_instance_id)
  WHERE zapi_instance_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_config_provider
  ON whatsapp_config (provider);
