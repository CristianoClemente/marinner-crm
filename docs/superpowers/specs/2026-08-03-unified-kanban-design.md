# Design: Kanban unificado no motor de processos

**Data:** 2026-08-03  
**Status:** implementação  
**Abordagem:** estender `process_*` (não Workflow abstrato; não dois boards long-term)

## Norte

Uma superfície de **Kanban** e um **criador de funis** personalizável. Venda e operação diferem por **capacidades do template**, não por módulos separados.

## Decisões fechadas

| Tema | Decisão |
|------|---------|
| Motor | Único: `process_templates` + `enrollment_processes` |
| Avanço | `advance_mode` por template: `free` \| `sequential` |
| Sequential | `allow_skip` por etapa permanece |
| Free | Move para qualquer etapa do template (gate de campos se `block_advance_if_incomplete`) |
| Capacidades | Flags booleanas (não enum rígido `sales\|ops`) |
| Catálogo | `catalog_item_id` nullable quando `requires_catalog_item = false` |
| Comercial | Campos na instância: title, value, currency, assigned_to, expected_close_date, conversation_id, commercial_status |
| Outcomes | `commercial_status`: `open` \| `won` \| `lost` (nullable se template sem capacidade) |
| Status operacional | Continua `active` \| `completed` \| `canceled` |
| Mapeamento deal | `open` → active+open; `won` → completed+won; `lost` → canceled+lost |
| Eventos | Mantém `process.*`; automação `create_deal` vira criar instância em template comercial |
| Legacy | Migrar dados; DROP `pipelines`/`deals` só na fatia final |

## Capacidades do template

- `advance_mode`: `free` \| `sequential` (default `sequential`)
- `has_monetary_value`
- `has_commercial_outcome`
- `requires_catalog_item` (default `true`)
- Já existentes: campos por etapa, `accepts_classes`, `block_advance_if_incomplete`

## Schema

Ver migration `061_unified_kanban.sql` (+ `062` migração de dados, `063` DROP legacy).

## APIs

- Templates: aceitar flags + `catalog_item_id` opcional
- `POST …/advance`: com `advance_mode=free` e `target_stage_id`, permite qualquer etapa do template
- Processos: PATCH campos comerciais quando capacidades ativas
- Completar com outcome comercial: won → completed; lost → cancelado com commercial_status

## UI

- `/processes` — Kanban único (seletor de funil; drag free se aplicável; valor no card)
- `/process-templates` — criador de funis (copy “Funis”; wizard de capacidades)
- `/pipelines` — redirect para `/processes`
- Nav: Kanban + Funis; remover Pipelines

## Critérios de sucesso

- Um Kanban e um criador na nav
- Funil venda (free + valor + won/lost) e habilitação (sequential + campos + turmas) no mesmo builder
- Deals migrados visíveis no Kanban
- typecheck/lint/testes de advance passam
