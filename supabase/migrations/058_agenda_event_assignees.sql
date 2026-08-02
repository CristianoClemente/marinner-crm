-- Múltiplos integrantes por item da Agenda.
-- Spec: docs/superpowers/specs/2026-07-31-agenda-events-slice-design.md

CREATE TABLE IF NOT EXISTS agenda_event_assignees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES agenda_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_agenda_event_assignees_event
  ON agenda_event_assignees (event_id);

CREATE INDEX IF NOT EXISTS idx_agenda_event_assignees_user
  ON agenda_event_assignees (account_id, user_id);

COMMENT ON TABLE agenda_event_assignees IS
  'Integrantes atribuídos a lembrete/evento da Agenda (N:N).';

-- Migra assignee único legado, se existir.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'agenda_events'
      AND column_name = 'assignee_user_id'
  ) THEN
    INSERT INTO agenda_event_assignees (account_id, event_id, user_id)
    SELECT account_id, id, assignee_user_id
    FROM agenda_events
    WHERE assignee_user_id IS NOT NULL
    ON CONFLICT (event_id, user_id) DO NOTHING;

    ALTER TABLE agenda_events DROP COLUMN assignee_user_id;
  END IF;
END $$;

ALTER TABLE agenda_event_assignees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agenda_event_assignees_select ON agenda_event_assignees;
CREATE POLICY agenda_event_assignees_select ON agenda_event_assignees
  FOR SELECT USING (is_account_member(account_id, 'viewer'));

DROP POLICY IF EXISTS agenda_event_assignees_insert ON agenda_event_assignees;
CREATE POLICY agenda_event_assignees_insert ON agenda_event_assignees
  FOR INSERT WITH CHECK (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS agenda_event_assignees_update ON agenda_event_assignees;
CREATE POLICY agenda_event_assignees_update ON agenda_event_assignees
  FOR UPDATE USING (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS agenda_event_assignees_delete ON agenda_event_assignees;
CREATE POLICY agenda_event_assignees_delete ON agenda_event_assignees
  FOR DELETE USING (is_account_member(account_id, 'admin'));
