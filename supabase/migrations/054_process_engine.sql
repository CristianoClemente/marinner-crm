-- Fatia 1: motor de processo (templates + enrollment).
-- Spec: docs/superpowers/specs/2026-07-30-process-engine-slice1-design.md

CREATE TABLE IF NOT EXISTS process_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  catalog_item_id UUID NOT NULL REFERENCES catalog_items(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_process_templates_account
  ON process_templates (account_id, active, name);

DROP TRIGGER IF EXISTS set_updated_at ON process_templates;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON process_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE process_templates IS
  'Template de processo operacional (habilitação, despachante, …) ligado a catalog_items.';

CREATE TABLE IF NOT EXISTS process_template_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES process_templates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INT NOT NULL CHECK (position >= 0),
  allow_skip BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (template_id, position)
);

CREATE INDEX IF NOT EXISTS idx_process_template_stages_template
  ON process_template_stages (template_id, position);

COMMENT ON TABLE process_template_stages IS
  'Etapas genéricas ordenadas do template. allow_skip permite pular a partir desta etapa.';

CREATE TABLE IF NOT EXISTS enrollment_processes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES process_templates(id) ON DELETE RESTRICT,
  current_stage_id UUID REFERENCES process_template_stages(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'canceled')),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  opened_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_enrollment_processes_account_status
  ON enrollment_processes (account_id, status, opened_at DESC);

CREATE INDEX IF NOT EXISTS idx_enrollment_processes_contact
  ON enrollment_processes (contact_id, status);

DROP TRIGGER IF EXISTS set_updated_at ON enrollment_processes;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON enrollment_processes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE enrollment_processes IS
  'Instância de processo no contato. Vários active em paralelo são permitidos.';

CREATE TABLE IF NOT EXISTS process_stage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  process_id UUID NOT NULL REFERENCES enrollment_processes(id) ON DELETE CASCADE,
  from_stage_id UUID REFERENCES process_template_stages(id) ON DELETE SET NULL,
  to_stage_id UUID REFERENCES process_template_stages(id) ON DELETE SET NULL,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_process_stage_history_process
  ON process_stage_history (process_id, created_at DESC);

CREATE TABLE IF NOT EXISTS process_domain_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_process_domain_events_pending
  ON process_domain_events (account_id, created_at)
  WHERE processed_at IS NULL;

COMMENT ON TABLE process_domain_events IS
  'Outbox de eventos process.* para automações (fatia 7).';

ALTER TABLE process_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_template_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollment_processes ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_stage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_domain_events ENABLE ROW LEVEL SECURITY;

-- Templates
DROP POLICY IF EXISTS process_templates_select ON process_templates;
CREATE POLICY process_templates_select ON process_templates
  FOR SELECT USING (is_account_member(account_id));
DROP POLICY IF EXISTS process_templates_insert ON process_templates;
CREATE POLICY process_templates_insert ON process_templates
  FOR INSERT WITH CHECK (is_account_member(account_id, 'admin'));
DROP POLICY IF EXISTS process_templates_update ON process_templates;
CREATE POLICY process_templates_update ON process_templates
  FOR UPDATE USING (is_account_member(account_id, 'admin'));
DROP POLICY IF EXISTS process_templates_delete ON process_templates;
CREATE POLICY process_templates_delete ON process_templates
  FOR DELETE USING (is_account_member(account_id, 'admin'));

-- Stages
DROP POLICY IF EXISTS process_template_stages_select ON process_template_stages;
CREATE POLICY process_template_stages_select ON process_template_stages
  FOR SELECT USING (is_account_member(account_id));
DROP POLICY IF EXISTS process_template_stages_insert ON process_template_stages;
CREATE POLICY process_template_stages_insert ON process_template_stages
  FOR INSERT WITH CHECK (is_account_member(account_id, 'admin'));
DROP POLICY IF EXISTS process_template_stages_update ON process_template_stages;
CREATE POLICY process_template_stages_update ON process_template_stages
  FOR UPDATE USING (is_account_member(account_id, 'admin'));
DROP POLICY IF EXISTS process_template_stages_delete ON process_template_stages;
CREATE POLICY process_template_stages_delete ON process_template_stages
  FOR DELETE USING (is_account_member(account_id, 'admin'));

-- Processes
DROP POLICY IF EXISTS enrollment_processes_select ON enrollment_processes;
CREATE POLICY enrollment_processes_select ON enrollment_processes
  FOR SELECT USING (is_account_member(account_id));
DROP POLICY IF EXISTS enrollment_processes_insert ON enrollment_processes;
CREATE POLICY enrollment_processes_insert ON enrollment_processes
  FOR INSERT WITH CHECK (is_account_member(account_id, 'agent'));
DROP POLICY IF EXISTS enrollment_processes_update ON enrollment_processes;
CREATE POLICY enrollment_processes_update ON enrollment_processes
  FOR UPDATE USING (is_account_member(account_id, 'agent'));

-- History
DROP POLICY IF EXISTS process_stage_history_select ON process_stage_history;
CREATE POLICY process_stage_history_select ON process_stage_history
  FOR SELECT USING (is_account_member(account_id));
DROP POLICY IF EXISTS process_stage_history_insert ON process_stage_history;
CREATE POLICY process_stage_history_insert ON process_stage_history
  FOR INSERT WITH CHECK (is_account_member(account_id, 'agent'));

-- Events: members read; insert via agent+ (API); processed_at via service role later
DROP POLICY IF EXISTS process_domain_events_select ON process_domain_events;
CREATE POLICY process_domain_events_select ON process_domain_events
  FOR SELECT USING (is_account_member(account_id, 'admin'));
DROP POLICY IF EXISTS process_domain_events_insert ON process_domain_events;
CREATE POLICY process_domain_events_insert ON process_domain_events
  FOR INSERT WITH CHECK (is_account_member(account_id, 'agent'));
