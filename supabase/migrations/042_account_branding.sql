-- ============================================================
-- 042_account_branding.sql
--
-- Identidade da escola (Fatia 1 white-label):
--   1. accounts.slug + accounts.logo_url
--   2. Bucket Storage account-branding (logo público)
--
-- Resolução Host→tenant e cookies cross-subdomain ficam na Fatia 2.
-- Idempotent — safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Colunas de marca
-- ------------------------------------------------------------
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS slug TEXT NULL;

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS logo_url TEXT NULL;

-- Formato: minúsculas, dígitos e hífen; 3–48 chars.
-- Reservados (app/www/admin/api/mail) são barrados no app
-- (isReservedSubdomain) — CHECK só garante o shape.
ALTER TABLE accounts
  DROP CONSTRAINT IF EXISTS accounts_slug_format;
ALTER TABLE accounts
  ADD CONSTRAINT accounts_slug_format
  CHECK (
    slug IS NULL
    OR slug ~ '^[a-z0-9]([a-z0-9-]{1,46}[a-z0-9])$'
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_slug_unique
  ON accounts (slug)
  WHERE slug IS NOT NULL;

COMMENT ON COLUMN accounts.slug IS
  'Subdomínio futuro (ex.: escola-nautica → escola-nautica.{DOMAIN_BASE}). Único quando preenchido.';
COMMENT ON COLUMN accounts.logo_url IS
  'URL pública do logotipo (bucket account-branding).';

-- ------------------------------------------------------------
-- 2. Storage — account-branding
-- Path: account-<account_id>/logo-<timestamp>.<ext>
-- Write: admin+ da conta; read: público (img tags sem signed URL).
-- ------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'account-branding',
  'account-branding',
  TRUE,
  2097152, -- 2 MB
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Account branding is publicly readable" ON storage.objects;
CREATE POLICY "Account branding is publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'account-branding');

DROP POLICY IF EXISTS "Admins can upload account branding" ON storage.objects;
CREATE POLICY "Admins can upload account branding"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'account-branding'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.account_role IN ('owner', 'admin')
        AND ('account-' || p.account_id::text) = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS "Admins can update account branding" ON storage.objects;
CREATE POLICY "Admins can update account branding"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'account-branding'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.account_role IN ('owner', 'admin')
        AND ('account-' || p.account_id::text) = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS "Admins can delete account branding" ON storage.objects;
CREATE POLICY "Admins can delete account branding"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'account-branding'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.account_role IN ('owner', 'admin')
        AND ('account-' || p.account_id::text) = (storage.foldername(name))[1]
    )
  );
