-- Agenda geral: lembrete + evento (Turma permanece em process_classes).
-- Spec: docs/superpowers/specs/2026-07-31-agenda-events-slice-design.md

CREATE TABLE IF NOT EXISTS agenda_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('reminder', 'event')),
  title TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  color_key TEXT NOT NULL DEFAULT 'orange'
    CHECK (color_key IN (
      'orange', 'sky', 'emerald', 'violet', 'rose', 'amber', 'slate', 'teal'
    )),
  assignee_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'canceled')),
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT agenda_events_ends_after_starts
    CHECK (ends_at IS NULL OR ends_at >= starts_at)
);

CREATE INDEX IF NOT EXISTS idx_agenda_events_account_starts
  ON agenda_events (account_id, starts_at);

CREATE INDEX IF NOT EXISTS idx_agenda_events_assignee
  ON agenda_events (account_id, assignee_user_id)
  WHERE assignee_user_id IS NOT NULL;

DROP TRIGGER IF EXISTS set_updated_at ON agenda_events;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON agenda_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE agenda_events IS
  'Itens leves da Agenda (lembrete/evento). Turmas ficam em process_classes.';

ALTER TABLE agenda_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agenda_events_select ON agenda_events;
CREATE POLICY agenda_events_select ON agenda_events
  FOR SELECT USING (is_account_member(account_id, 'viewer'));

DROP POLICY IF EXISTS agenda_events_insert ON agenda_events;
CREATE POLICY agenda_events_insert ON agenda_events
  FOR INSERT WITH CHECK (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS agenda_events_update ON agenda_events;
CREATE POLICY agenda_events_update ON agenda_events
  FOR UPDATE USING (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS agenda_events_delete ON agenda_events;
CREATE POLICY agenda_events_delete ON agenda_events
  FOR DELETE USING (is_account_member(account_id, 'admin'));
