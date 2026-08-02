# Design: Agenda geral — Lembrete + Evento

**Data:** 2026-07-31  
**Status:** implementado  
**Depende de:** `2026-07-31-agenda-turma-slice1-design.md`

## Objetivo

A Agenda deixa de ser só superfície de Turma: calendário operacional da escola com **Turma** (domínio processo), **Lembrete** e **Evento** (itens leves). Item de nav no nível principal (fora do submenu Escola).

## Decisões

| Tema | Decisão |
|------|---------|
| Nav | `/agenda` em `PRIMARY_NAV` (fora de Escola) |
| Turma | `process_classes`; sheet só cria; detalhe em `/agenda/turmas/[id]` |
| Lembrete / Evento | Tabela `agenda_events` (`kind`: `reminder` \| `event`) |
| Cor | Paleta fixa (~8 keys semânticas), não color picker livre |
| Integrante | Vários via `agenda_event_assignees` (N:N); opcional |
| Anotações | `notes` texto |
| Evento | `ends_at` opcional; Lembrete só `starts_at` |
| Roles | viewer+ leitura; admin+ escrita (igual Turma) |
| Fora | reunião/bloqueio, recorrência, push/WhatsApp, multi-assignee |

## Schema

```text
agenda_events
  id, account_id
  kind reminder | event
  title text NOT NULL
  starts_at timestamptz NOT NULL
  ends_at timestamptz NULL
  color_key text NOT NULL  -- ex.: orange, sky, emerald, …
  notes text NULL
  status active | canceled
  created_by_user_id, created_at, updated_at

agenda_event_assignees
  event_id, user_id (UNIQUE), account_id
```

RLS: viewer select; admin insert/update/delete.

## APIs

- `GET/POST /api/agenda/events` — lista por `from`/`to`; cria (`assignee_user_ids[]`)
- `GET/PATCH /api/agenda/events/[id]` — detalhe / atualiza / cancela
- Calendário UI: `GET /api/classes` + `GET /api/agenda/events` no mesmo range

## UI

- Botão Novo → menu: Turma | Lembrete | Evento
- `AgendaItemSheet` para reminder/event (cor chips, multi-integrantes, notes)
- Chip no calendário usa `color_key`; Turma mantém visual de tipo turma

## Fora de escopo

Recorrência, notificações, kinds extras, mover Turma para `agenda_events`.
