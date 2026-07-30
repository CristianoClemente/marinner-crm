-- Retenção/quota de mídia de conversas (R2 chat/).
-- Spec: docs/superpowers/specs/2026-07-30-chat-media-retention-quota-design.md

CREATE TABLE IF NOT EXISTS chat_media_objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  r2_key TEXT NOT NULL,
  public_url TEXT NOT NULL,
  bytes BIGINT NOT NULL CHECK (bytes >= 0),
  content_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS chat_media_objects_r2_key_uidx
  ON chat_media_objects (r2_key);

CREATE INDEX IF NOT EXISTS chat_media_objects_account_active_idx
  ON chat_media_objects (account_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS chat_media_objects_expires_idx
  ON chat_media_objects (expires_at)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE chat_media_objects IS
  'Catálogo de mídia de conversa no R2. Quota/retenção 180d; GC marca deleted_at.';

CREATE TABLE IF NOT EXISTS account_storage_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  extra_bytes BIGINT NOT NULL CHECK (extra_bytes > 0),
  label TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'canceled')),
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS account_storage_packages_account_active_idx
  ON account_storage_packages (account_id)
  WHERE status = 'active';

COMMENT ON TABLE account_storage_packages IS
  'Pacotes extras de GB (manual/admin). Retenção continua 180 dias.';

ALTER TABLE chat_media_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_storage_packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chat_media_objects_select ON chat_media_objects;
CREATE POLICY chat_media_objects_select ON chat_media_objects
  FOR SELECT USING (is_account_member(account_id));

DROP POLICY IF EXISTS chat_media_objects_insert ON chat_media_objects;
CREATE POLICY chat_media_objects_insert ON chat_media_objects
  FOR INSERT WITH CHECK (is_account_member(account_id, 'agent'));

DROP POLICY IF EXISTS chat_media_objects_update ON chat_media_objects;
CREATE POLICY chat_media_objects_update ON chat_media_objects
  FOR UPDATE USING (is_account_member(account_id, 'agent'));

DROP POLICY IF EXISTS account_storage_packages_select ON account_storage_packages;
CREATE POLICY account_storage_packages_select ON account_storage_packages
  FOR SELECT USING (is_account_member(account_id));

DROP POLICY IF EXISTS account_storage_packages_insert ON account_storage_packages;
CREATE POLICY account_storage_packages_insert ON account_storage_packages
  FOR INSERT WITH CHECK (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS account_storage_packages_update ON account_storage_packages;
CREATE POLICY account_storage_packages_update ON account_storage_packages
  FOR UPDATE USING (is_account_member(account_id, 'admin'));
