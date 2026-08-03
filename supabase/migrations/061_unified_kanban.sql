-- Kanban unificado: capacidades no template + campos comerciais na instância.
-- Spec: docs/superpowers/specs/2026-08-03-unified-kanban-design.md

-- Templates: avanço e capacidades
ALTER TABLE process_templates
  ALTER COLUMN catalog_item_id DROP NOT NULL;

ALTER TABLE process_templates
  ADD COLUMN IF NOT EXISTS advance_mode TEXT NOT NULL DEFAULT 'sequential',
  ADD COLUMN IF NOT EXISTS has_monetary_value BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_commercial_outcome BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_catalog_item BOOLEAN NOT NULL DEFAULT true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'process_templates_advance_mode_check'
  ) THEN
    ALTER TABLE process_templates
      ADD CONSTRAINT process_templates_advance_mode_check
      CHECK (advance_mode IN ('free', 'sequential'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'process_templates_catalog_required_check'
  ) THEN
    ALTER TABLE process_templates
      ADD CONSTRAINT process_templates_catalog_required_check
      CHECK (
        requires_catalog_item = false
        OR catalog_item_id IS NOT NULL
      );
  END IF;
END $$;

COMMENT ON COLUMN process_templates.advance_mode IS
  'free = mover para qualquer etapa; sequential = ordem + allow_skip.';
COMMENT ON COLUMN process_templates.requires_catalog_item IS
  'Se true, catalog_item_id é obrigatório (templates operacionais).';

-- Etapas: cor (paridade com pipeline_stages)
ALTER TABLE process_template_stages
  ADD COLUMN IF NOT EXISTS color TEXT;

-- Instâncias: campos comerciais (preenchidos conforme capacidades do template)
ALTER TABLE enrollment_processes
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS value NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency TEXT,
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS expected_close_date DATE,
  ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS commercial_status TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'enrollment_processes_commercial_status_check'
  ) THEN
    ALTER TABLE enrollment_processes
      ADD CONSTRAINT enrollment_processes_commercial_status_check
      CHECK (
        commercial_status IS NULL
        OR commercial_status IN ('open', 'won', 'lost')
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_enrollment_processes_commercial_status
  ON enrollment_processes (account_id, commercial_status)
  WHERE commercial_status IS NOT NULL;

COMMENT ON COLUMN enrollment_processes.commercial_status IS
  'Outcome comercial open|won|lost quando o template tem has_commercial_outcome.';
