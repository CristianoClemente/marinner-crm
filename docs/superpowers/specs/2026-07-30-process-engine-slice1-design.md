# Design: Fatia 1 — Motor de processo (templates + enrollment)

**Data:** 2026-07-30  
**Status:** aprovado (aguardando plano)  
**Abordagem:** A — domínio novo `process_*` (não reusar funil)  
**Epic:** `docs/superpowers/specs/2026-07-30-process-oriented-school-epic-design.md`

## Objetivo

Entregar o **esqueleto operacional** da escola: templates de processo ligados ao catálogo, abertura de N processos por contato, avanço de etapas genéricas com histórico e eventos para automações futuras.

## Decisões desta fatia

| Tema | Decisão |
|------|---------|
| Modelo | Tabelas `process_*` novas; funil intacto |
| Catálogo | FK para `catalog_items` (nome real no schema) |
| Etapas | Genéricas; `allow_skip` por etapa |
| Template vs processo ativo | **Template vivo** — processos ativos seguem a definição atual; UI avisa se template mudou |
| Congelar etapas na abertura | Fora (melhoria se doer em produção) |
| Instrutor | Sem operar processos nesta fatia (fatia 4) |
| Eventos | Outbox `process_domain_events`; sem consumer ainda |

## Escopo

**Inclui**
- CRUD templates + etapas
- Abrir / listar / kanban / avançar / concluir / cancelar processos
- Aba Processos no contato
- Histórico de avanço
- Outbox de eventos `process.created|stage_changed|completed|canceled`

**Exclui**
- Documentos, pagamento, aula, prova, dashboard home, automações, avanço por instrutor

## Schema

```text
process_templates
  id, account_id, catalog_item_id → catalog_items
  name, active, created_at, updated_at

process_template_stages
  id, account_id, template_id → process_templates
  name, position (int), allow_skip (bool default false)
  UNIQUE (template_id, position)

enrollment_processes
  id, account_id
  contact_id → contacts
  template_id → process_templates
  current_stage_id → process_template_stages (null se terminal)
  status: active | completed | canceled
  opened_at, completed_at, canceled_at
  opened_by_user_id

process_stage_history
  id, account_id, process_id
  from_stage_id, to_stage_id (nullable nos extremos)
  actor_user_id, note, created_at

process_domain_events
  id, account_id, event_type text, payload jsonb
  created_at, processed_at null
```

RLS: `is_account_member`; writes de template admin+; writes de processo agent+ (detalhe nas policies).

## Regras de negócio

1. Abrir processo: contato da conta + template `active` com ≥1 etapa; `current_stage_id` = primeira por `position`; evento `process.created`.
2. Avançar: só `active`; destino = próxima posição, ou qualquer posterior se etapa atual/`allow_skip` permitir (admin pode forçar com `note`); grava history + `process.stage_changed`.
3. Concluir: ao avançar além da última etapa, ou ação explícita na última; `status=completed`; `process.completed`.
4. Cancelar: `status=canceled`; `process.canceled`.
5. Vários `active` no mesmo `contact_id` permitidos (habilitação + despachante).
6. Não exigir deal/funil.

## APIs

| Método | Rota | Role |
|--------|------|------|
| GET/POST | `/api/process-templates` | GET viewer+; POST admin+ |
| GET/PATCH/DELETE | `/api/process-templates/[id]` | admin+ write |
| GET/PUT | `/api/process-templates/[id]/stages` | admin+ write |
| GET/POST | `/api/processes` | GET viewer+; POST agent+ |
| GET | `/api/processes/[id]` | viewer+ |
| POST | `/api/processes/[id]/advance` | agent+ |
| POST | `/api/processes/[id]/complete` | agent+ |
| POST | `/api/processes/[id]/cancel` | agent+ |
| GET | `/api/contacts/[id]/processes` | viewer+ |

Validação: type guards manuais (sem Zod). Auth: `requireRole` / `toErrorResponse`.

## UI

- `/process-templates` — gestão (admin)
- `/processes` — lista + kanban por `current_stage` (filtro template/status)
- Contato — aba Processos
- Nav: item Processos (agent+)
- i18n `messages/pt-BR.json`

## Eventos (payload mínimo)

```json
{
  "account_id": "...",
  "process_id": "...",
  "contact_id": "...",
  "template_id": "...",
  "actor_user_id": "...",
  "from_stage_id": null,
  "to_stage_id": "...",
  "at": "ISO-8601"
}
```

## Critérios de sucesso

- Template + etapas CRUD
- Dois processos ativos no mesmo contato
- Avanço / skip / complete / cancel + history
- Linhas na outbox
- `npm run typecheck` e `npm run lint` ok

## Fora / follow-ups

- Snapshot de etapas na abertura
- Marcar etapas “kind=lesson” para instrutor (fatia 4)
- Consumer de outbox → automações (fatia 7)
