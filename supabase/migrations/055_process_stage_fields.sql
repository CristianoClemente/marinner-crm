-- Fatia 2: campos configuráveis por etapa do processo.
-- Spec: docs/superpowers/specs/2026-07-30-process-stage-fields-slice2-design.md

ALTER TABLE process_templates
  ADD COLUMN IF NOT EXISTS block_advance_if_incomplete BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN process_templates.block_advance_if_incomplete IS
  'Se true, avanço da etapa atual exige todos os campos required preenchidos.';

CREATE TABLE IF NOT EXISTS process_template_stage_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  stage_id UUID NOT NULL REFERENCES process_template_stages(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  field_type TEXT NOT NULL
    CHECK (field_type IN ('file', 'checkbox', 'text', 'textarea', 'date', 'select')),
  required BOOLEAN NOT NULL DEFAULT false,
  position INT NOT NULL CHECK (position >= 0),
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (stage_id, position)
);

CREATE INDEX IF NOT EXISTS idx_process_template_stage_fields_stage
  ON process_template_stage_fields (stage_id, position);

DROP TRIGGER IF EXISTS set_updated_at ON process_template_stage_fields;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON process_template_stage_fields
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE process_template_stage_fields IS
  'Definição de campos do formulário de uma etapa do template (vivo).';

CREATE TABLE IF NOT EXISTS process_field_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  process_id UUID NOT NULL REFERENCES enrollment_processes(id) ON DELETE CASCADE,
  field_id UUID NOT NULL REFERENCES process_template_stage_fields(id) ON DELETE CASCADE,
  value JSONB,
  storage_path TEXT,
  original_filename TEXT,
  mime_type TEXT,
  size_bytes INT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (process_id, field_id)
);

CREATE INDEX IF NOT EXISTS idx_process_field_values_process
  ON process_field_values (process_id);

COMMENT ON TABLE process_field_values IS
  'Valores preenchidos no processo. file usa storage_path; demais usam value jsonb.';

ALTER TABLE process_template_stage_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_field_values ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS process_template_stage_fields_select ON process_template_stage_fields;
CREATE POLICY process_template_stage_fields_select ON process_template_stage_fields
  FOR SELECT USING (is_account_member(account_id));
DROP POLICY IF EXISTS process_template_stage_fields_insert ON process_template_stage_fields;
CREATE POLICY process_template_stage_fields_insert ON process_template_stage_fields
  FOR INSERT WITH CHECK (is_account_member(account_id, 'admin'));
DROP POLICY IF EXISTS process_template_stage_fields_update ON process_template_stage_fields;
CREATE POLICY process_template_stage_fields_update ON process_template_stage_fields
  FOR UPDATE USING (is_account_member(account_id, 'admin'));
DROP POLICY IF EXISTS process_template_stage_fields_delete ON process_template_stage_fields;
CREATE POLICY process_template_stage_fields_delete ON process_template_stage_fields
  FOR DELETE USING (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS process_field_values_select ON process_field_values;
CREATE POLICY process_field_values_select ON process_field_values
  FOR SELECT USING (is_account_member(account_id));
DROP POLICY IF EXISTS process_field_values_insert ON process_field_values;
CREATE POLICY process_field_values_insert ON process_field_values
  FOR INSERT WITH CHECK (is_account_member(account_id, 'agent'));
DROP POLICY IF EXISTS process_field_values_update ON process_field_values;
CREATE POLICY process_field_values_update ON process_field_values
  FOR UPDATE USING (is_account_member(account_id, 'agent'));
DROP POLICY IF EXISTS process_field_values_delete ON process_field_values;
CREATE POLICY process_field_values_delete ON process_field_values
  FOR DELETE USING (is_account_member(account_id, 'agent'));
