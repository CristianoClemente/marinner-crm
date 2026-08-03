-- Migra pipelines/stages/deals → process_templates / stages / enrollment_processes.
-- Spec: docs/superpowers/specs/2026-08-03-unified-kanban-design.md
-- Tabelas legado permanecem até 063_drop_legacy_pipelines.sql

-- Mapa pipeline → template (mesmo UUID para rewire simples de automações)
INSERT INTO process_templates (
  id,
  account_id,
  catalog_item_id,
  name,
  active,
  advance_mode,
  has_monetary_value,
  has_commercial_outcome,
  requires_catalog_item,
  created_at,
  updated_at
)
SELECT
  p.id,
  p.account_id,
  NULL,
  p.name,
  true,
  'free',
  true,
  true,
  false,
  COALESCE(p.created_at, now()),
  now()
FROM pipelines p
WHERE p.account_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM process_templates t WHERE t.id = p.id
  );

INSERT INTO process_template_stages (
  id,
  account_id,
  template_id,
  name,
  position,
  allow_skip,
  accepts_classes,
  color,
  created_at
)
SELECT
  s.id,
  p.account_id,
  s.pipeline_id,
  s.name,
  s.position,
  false,
  false,
  s.color,
  COALESCE(s.created_at, now())
FROM pipeline_stages s
INNER JOIN pipelines p ON p.id = s.pipeline_id
WHERE p.account_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM process_template_stages t WHERE t.id = s.id
  );

INSERT INTO enrollment_processes (
  id,
  account_id,
  contact_id,
  template_id,
  current_stage_id,
  status,
  title,
  value,
  currency,
  assigned_to,
  expected_close_date,
  conversation_id,
  commercial_status,
  opened_at,
  completed_at,
  canceled_at,
  opened_by_user_id,
  created_at,
  updated_at
)
SELECT
  d.id,
  COALESCE(d.account_id, p.account_id),
  d.contact_id,
  d.pipeline_id,
  CASE
    WHEN d.status IN ('won', 'lost') THEN NULL
    ELSE d.stage_id
  END,
  CASE
    WHEN d.status = 'won' THEN 'completed'
    WHEN d.status = 'lost' THEN 'canceled'
    ELSE 'active'
  END,
  d.title,
  COALESCE(d.value, 0),
  d.currency,
  d.assigned_to,
  d.expected_close_date,
  d.conversation_id,
  CASE
    WHEN d.status = 'won' THEN 'won'
    WHEN d.status = 'lost' THEN 'lost'
    WHEN d.status IN ('open', 'active') THEN 'open'
    ELSE 'open'
  END,
  COALESCE(d.created_at, now()),
  CASE WHEN d.status = 'won' THEN COALESCE(d.updated_at, now()) ELSE NULL END,
  CASE WHEN d.status = 'lost' THEN COALESCE(d.updated_at, now()) ELSE NULL END,
  d.user_id,
  COALESCE(d.created_at, now()),
  COALESCE(d.updated_at, now())
FROM deals d
INNER JOIN pipelines p ON p.id = d.pipeline_id
WHERE COALESCE(d.account_id, p.account_id) IS NOT NULL
  AND d.contact_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM enrollment_processes e WHERE e.id = d.id
  );

-- Histórico mínimo: abertura na etapa atual (ou concluído/cancelado)
INSERT INTO process_stage_history (
  account_id,
  process_id,
  from_stage_id,
  to_stage_id,
  actor_user_id,
  note,
  created_at
)
SELECT
  e.account_id,
  e.id,
  NULL,
  e.current_stage_id,
  e.opened_by_user_id,
  'Migrado do funil comercial',
  e.opened_at
FROM enrollment_processes e
INNER JOIN deals d ON d.id = e.id
WHERE NOT EXISTS (
  SELECT 1 FROM process_stage_history h WHERE h.process_id = e.id
);

COMMENT ON TABLE pipelines IS
  'DEPRECATED: migrado para process_templates (061/062). Remover em 063.';
COMMENT ON TABLE deals IS
  'DEPRECATED: migrado para enrollment_processes (061/062). Remover em 063.';
