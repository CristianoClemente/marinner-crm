# Design: Fatia 1 — Agenda + evento Turma

**Data:** 2026-07-31  
**Status:** implementado (ops)  
**Epic:** `docs/superpowers/specs/2026-07-30-process-oriented-school-epic-design.md`  
**Plano:** Agenda como calendário; Turma como único tipo de evento nesta fatia

## Objetivo

A escola controla a agenda presencial: no calendário cria um evento **Turma** (sessão única), configura local/vagas (instrutor e equipamento opcionais) e aloca alunos cujo processo está na etapa marcada **Usa turmas**.

## Decisões

| Tema | Decisão |
|------|---------|
| Superfície | Módulo **Agenda** (`/agenda` no nav principal, fora de Escola) |
| Turma | Tipo de evento (componente sheet); único kind nesta fatia |
| Sessão | Uma data/hora (`starts_at`) + `capacity` |
| Processo | Turma não substitui enrollment; aloca `enrollment_processes` na etapa |
| Etapa | Flag `accepts_classes` no template |
| Instrutor | Nullable na abertura; operador atribui depois |
| Fechar | Não avança processo |
| Finanças | Fora desta fatia (modelo com FKs preparado) |
| Self-service instrutor | Fora desta fatia |
| Eventos genéricos | Sem tabela `agenda_events` ainda (YAGNI); calendário lê `process_classes` |

## Schema

```text
process_template_stages
  + accepts_classes boolean NOT NULL DEFAULT false

process_classes
  id, account_id
  template_stage_id → process_template_stages
  location_id → class_locations NOT NULL
  instructor_id → instructors NULL
  equipment_id → equipment NULL
  starts_at timestamptz NOT NULL
  capacity int NOT NULL CHECK > 0
  status open | closed | canceled
  name text NULL
  opened_at, closed_at, created_by_user_id
  created_at, updated_at

process_class_enrollments
  id, account_id
  class_id → process_classes ON DELETE CASCADE
  process_id → enrollment_processes ON DELETE CASCADE
  enrolled_at, enrolled_by_user_id
  UNIQUE (class_id, process_id)
```

Curso = `catalog_item` via `stage → template → catalog_item_id`.

## APIs

- `GET/POST /api/classes` — lista (filtro por mês/`from`/`to`) e cria
- `GET/PATCH /api/classes/[id]` — detalhe / atualiza (incl. instrutor) / fecha / cancela
- `GET /api/classes/[id]/pool` — candidatos à etapa
- `POST/DELETE /api/classes/[id]/enrollments` — alocar / remover aluno
- Stages PUT/PATCH já existentes passam a aceitar `accepts_classes`

Roles: admin+ escrita; viewer+ leitura (nav Agenda = admin+ nesta fatia).

## UI

- Agenda no nav principal (`/agenda`)
- Calendário mês + painel do dia
- Sheet `TurmaEventSheet`: **somente criar** → redireciona para `/agenda/turmas/[id]`
- Página de detalhe `/agenda/turmas/[id]`: editar, alunos, fechar/cancelar; voltar com `?day=`
- Clique em turma no calendário abre a página de detalhe
- Template: checkbox **Usa turmas** por etapa

## Fora de escopo

- Lucro/gasto, presença, multi-sessão, outros kinds de evento, avanço automático, UI instrutor
