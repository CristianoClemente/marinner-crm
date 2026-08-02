-- Fatia Agenda + evento Turma (sessão na etapa do processo).
-- Spec: docs/superpowers/specs/2026-07-31-agenda-turma-slice1-design.md

ALTER TABLE process_template_stages
  ADD COLUMN IF NOT EXISTS accepts_classes BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN process_template_stages.accepts_classes IS
  'Etapa entra no módulo Agenda como evento Turma (ex.: aula prática).';

CREATE TABLE IF NOT EXISTS process_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  template_stage_id UUID NOT NULL REFERENCES process_template_stages(id) ON DELETE RESTRICT,
  location_id UUID NOT NULL REFERENCES class_locations(id) ON DELETE RESTRICT,
  instructor_id UUID REFERENCES instructors(id) ON DELETE SET NULL,
  equipment_id UUID REFERENCES equipment(id) ON DELETE SET NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  capacity INT NOT NULL CHECK (capacity > 0),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'closed', 'canceled')),
  name TEXT,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_process_classes_account_starts
  ON process_classes (account_id, starts_at);

CREATE INDEX IF NOT EXISTS idx_process_classes_stage_status
  ON process_classes (template_stage_id, status);

DROP TRIGGER IF EXISTS set_updated_at ON process_classes;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON process_classes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE process_classes IS
  'Turma = sessão única na Agenda, ligada a uma etapa que accepts_classes.';

CREATE TABLE IF NOT EXISTS process_class_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES process_classes(id) ON DELETE CASCADE,
  process_id UUID NOT NULL REFERENCES enrollment_processes(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  enrolled_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (class_id, process_id)
);

CREATE INDEX IF NOT EXISTS idx_process_class_enrollments_process
  ON process_class_enrollments (process_id);

CREATE INDEX IF NOT EXISTS idx_process_class_enrollments_class
  ON process_class_enrollments (class_id);

COMMENT ON TABLE process_class_enrollments IS
  'Alunos (processos) alocados em uma turma/sessão.';

ALTER TABLE process_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_class_enrollments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS process_classes_select ON process_classes;
CREATE POLICY process_classes_select ON process_classes
  FOR SELECT USING (is_account_member(account_id, 'viewer'));

DROP POLICY IF EXISTS process_classes_insert ON process_classes;
CREATE POLICY process_classes_insert ON process_classes
  FOR INSERT WITH CHECK (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS process_classes_update ON process_classes;
CREATE POLICY process_classes_update ON process_classes
  FOR UPDATE USING (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS process_classes_delete ON process_classes;
CREATE POLICY process_classes_delete ON process_classes
  FOR DELETE USING (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS process_class_enrollments_select ON process_class_enrollments;
CREATE POLICY process_class_enrollments_select ON process_class_enrollments
  FOR SELECT USING (is_account_member(account_id, 'viewer'));

DROP POLICY IF EXISTS process_class_enrollments_insert ON process_class_enrollments;
CREATE POLICY process_class_enrollments_insert ON process_class_enrollments
  FOR INSERT WITH CHECK (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS process_class_enrollments_update ON process_class_enrollments;
CREATE POLICY process_class_enrollments_update ON process_class_enrollments
  FOR UPDATE USING (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS process_class_enrollments_delete ON process_class_enrollments;
CREATE POLICY process_class_enrollments_delete ON process_class_enrollments
  FOR DELETE USING (is_account_member(account_id, 'admin'));
