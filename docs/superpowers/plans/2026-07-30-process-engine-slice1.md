# Process Engine Slice 1 — Implementation Plan

> **For agentic workers:** Execute task-by-task. Apply DB via Supabase MCP.

**Goal:** Motor de processo (templates, etapas, enrollment, avanço, UI básica, outbox).

**Architecture:** Domínio `process_*`; APIs `requireRole`; UI `/processes` + `/process-templates` + aba contato.

**Tech:** Postgres/RLS, Next.js App Router, pt-BR.

## Tasks

1. Migration `054_process_engine.sql` + MCP `apply_migration`
2. Types + `src/lib/processes/*` (advance rules + emit event) + testes
3. APIs templates/stages/processes
4. UI + nav + i18n + contact tab
5. Update PRODUCT.md + epic status; typecheck/lint; commit
