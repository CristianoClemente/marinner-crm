-- Documentos de habilitação gerados (PDF).
-- Spec: docs/superpowers/specs/2026-08-03-habilitation-documents-design.md

ALTER TABLE process_templates
  ADD COLUMN IF NOT EXISTS habilitation_kind TEXT
    CHECK (habilitation_kind IS NULL OR habilitation_kind IN ('arrais', 'motonauta'));

COMMENT ON COLUMN process_templates.habilitation_kind IS
  'Deriva atestado/requerimento NORMAM: arrais (211) ou motonauta (212).';

CREATE TABLE IF NOT EXISTS generated_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  kind TEXT NOT NULL
    CHECK (kind IN (
      'atestado_arrais',
      'atestado_motonauta',
      'declaracao_residencia',
      'requerimento_capitania'
    )),
  template_version TEXT NOT NULL,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  process_id UUID REFERENCES enrollment_processes(id) ON DELETE SET NULL,
  class_id UUID REFERENCES process_classes(id) ON DELETE SET NULL,
  enrollment_id UUID REFERENCES process_class_enrollments(id) ON DELETE SET NULL,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_generated_documents_account_created
  ON generated_documents (account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_generated_documents_contact
  ON generated_documents (contact_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_generated_documents_process
  ON generated_documents (process_id, created_at DESC)
  WHERE process_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_generated_documents_class
  ON generated_documents (class_id, created_at DESC)
  WHERE class_id IS NOT NULL;

COMMENT ON TABLE generated_documents IS
  'PDFs de habilitação gerados (NORMAM). Cada emissão é imutável; reemitir cria nova linha.';

ALTER TABLE generated_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS generated_documents_select ON generated_documents;
CREATE POLICY generated_documents_select ON generated_documents
  FOR SELECT USING (is_account_member(account_id, 'viewer'));

DROP POLICY IF EXISTS generated_documents_insert ON generated_documents;
CREATE POLICY generated_documents_insert ON generated_documents
  FOR INSERT WITH CHECK (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS generated_documents_delete ON generated_documents;
CREATE POLICY generated_documents_delete ON generated_documents
  FOR DELETE USING (is_account_member(account_id, 'admin'));
