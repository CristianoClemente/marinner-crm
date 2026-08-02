# Campos por etapa (Fatia 2) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven-development) task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Formulário configurável por etapa do template + slideover com Salvar único + gate soft/hard no avanço + arquivos em R2 `process-docs`.

**Architecture:** Definições em `process_template_stage_fields`; valores em `process_field_values`. Upload no `PUT /api/processes/[id]/fields` (multipart) via `putR2Object` com key `processes/account-…/process-…/field-…`. UI: builder no editor de template; `ProcessStageFieldsSheet` no board.

**Tech Stack:** Next.js 16 App Router, Supabase RLS, R2 (`src/lib/storage`), Vitest, next-intl pt-BR, shadcn Sheet/Dialog.

**Spec:** `docs/superpowers/specs/2026-07-30-process-stage-fields-slice2-design.md`

## Global Constraints

- pt-BR only (`messages/pt-BR.json`); sem Zod; auth `requireRole` / `toErrorResponse`
- Sem eventos outbox nesta fatia; sem tipar etapa
- Clique no card: slideover de campos se `fields_total > 0`, senão detalhe
- `npm run typecheck` + lint nos arquivos tocados

## File map

| Path | Role |
|------|------|
| `supabase/migrations/055_process_stage_fields.sql` | Schema + RLS |
| `src/lib/processes/types.ts` | Tipos |
| `src/lib/processes/field-types.ts` | Guards, complete, config |
| `src/lib/processes/field-values.ts` | Missing / summary |
| `src/lib/processes/validate-fields.ts` | Validação body fields |
| `src/lib/storage/bucket-map.ts` | `process-docs` |
| `src/app/api/process-templates/[id]/stages/[stageId]/fields/route.ts` | GET/PUT defs |
| `src/app/api/process-templates/[id]/route.ts` | PATCH flag |
| `src/app/api/processes/[id]/fields/route.ts` | GET/PUT valores |
| `src/app/api/processes/[id]/advance/route.ts` | Gate |
| `src/app/api/processes/[id]/route.ts` | Resumo fields opcional |
| `src/components/process-templates/stage-fields-editor.tsx` | Builder |
| `src/components/processes/process-field-control.tsx` | Controle por tipo |
| `src/components/processes/process-stage-fields-sheet.tsx` | Slideover |
| `src/app/(dashboard)/process-templates/page.tsx` | Integra builder + flag |
| `src/app/(dashboard)/processes/page.tsx` + board | Wire UI |
| `messages/pt-BR.json` | Copy |

---

### Task 1: Migration + domain lib

**Files:** Create migration; modify `types.ts`; create `field-types.ts`, `field-values.ts`, `validate-fields.ts` + tests.

- [ ] **Step 1:** Migration `055_process_stage_fields.sql` (column + tables + RLS agent write values / admin write defs)
- [ ] **Step 2:** Types + `FIELD_TYPES` + `isFieldComplete` + `requiredMissing` + `validateFieldsReplace`
- [ ] **Step 3:** Vitest for complete/missing/validate
- [ ] **Step 4:** Apply migration (Supabase MCP or CLI)

### Task 2: Storage `process-docs`

**Files:** `bucket-map.ts` (+ tests), optionally helper `buildProcessDocKey`

- [ ] Add logical bucket; prefix `processes/`; key with processId+fieldId; `assertPathAllowed`; `minRoleForBucket` → agent
- [ ] Generic `/api/storage/upload` **rejeita** `process-docs` (400) — upload só via PUT fields

### Task 3: APIs

- [ ] GET/PUT template stage fields (sync: update by id, insert new, delete removed — evitar wipe cego se body trouxer `id`)
- [ ] PATCH template `block_advance_if_incomplete`
- [ ] GET/PUT process fields (multipart Salvar)
- [ ] Advance gate + GET process field summary

### Task 4: Template UI

- [ ] `StageFieldsEditor` + switch no dialog de template
- [ ] i18n keys

### Task 5: Operate UI

- [ ] `ProcessFieldControl` + `ProcessStageFieldsSheet` (draft + Salvar + discard confirm)
- [ ] Board: badge + open fields vs detail; advance dialog soft/hard
- [ ] Detail sheet: CTA Preencher etapa

### Task 6: Verify + product docs

- [ ] `typecheck`, scoped lint, vitest storage/processes
- [ ] Update `PRODUCT.md` + epic status; mark spec implemented when done

---

**Execution:** inline nesta sessão (usuário pediu iniciar).
