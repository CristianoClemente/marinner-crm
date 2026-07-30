# Locais de Aula — Implementation Plan

> **For agentic workers:** Implement task-by-task. Steps use checkbox syntax.

**Goal:** CRUD de locais de aula com despesa condicional e regras de bônus genéricas por local.

**Architecture:** Tabelas `class_locations` + `class_location_bonus_rules`; validação pura + resolve; API REST; UI padrão Catálogo. Agent+ lê; Admin+ escreve.

**Tech Stack:** Next.js 16 App Router, Supabase RLS, Vitest, next-intl pt-BR.

**Spec:** `docs/superpowers/specs/2026-07-29-class-locations-design.md`

## Tasks

- [x] 1. Migration `047_class_locations.sql` + apply remoto
- [x] 2. `validate.ts` + `resolve-bonus.ts` + testes
- [x] 3. Tipos em `@/types`
- [x] 4. API `/api/class-locations/**`
- [x] 5. UI `/class-locations` + form + seção bônus
- [x] 6. i18n + sidebar
- [x] 7. typecheck + lint + vitest
