# Chat Media Retention & Quota — Implementation Plan

> **For agentic workers:** Use executing-plans / implement task-by-task. Steps use checkbox syntax.

**Goal:** Registrar mídia de conversa, quota 5 GB + pacotes admin, retenção 180 dias com cron de exclusão, UI de uso.

**Architecture:** Tabela `chat_media_objects` + `account_storage_packages`; gate no upload `chat-media`; cron com secret; Settings → Armazenamento.

**Tech Stack:** Postgres/RLS, Next.js API, R2 DeleteObject, Vitest, next-intl.

## Global Constraints

- Retenção 180 dias; base 5 GiB; pacotes só GB; hard block; sem Asaas nesta fatia
- Auth `requireRole` / cron secret; pt-BR

## File map

| File | Role |
|------|------|
| `supabase/migrations/053_chat_media_quota.sql` | Schema + RLS |
| `src/lib/storage/chat-quota.ts` | Constantes, cálculo quota/uso |
| `src/lib/storage/chat-quota.test.ts` | Testes |
| `src/lib/storage/chat-media-gc.ts` | GC expirados |
| Upload/delete/cron/APIs/UI/docs | Conforme spec |

### Task 1: Migration + quota lib
### Task 2: Upload gate + registro + delete marca deleted + link message + cron
### Task 3: APIs + Settings UI + i18n
### Task 4: Docs (`docs/chat-media-retention.md`, atualizar spec/guia R2) + verify
