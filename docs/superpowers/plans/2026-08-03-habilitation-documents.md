# Documentos de habilitação — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven-development) task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gerar PDFs fiéis aos anexos NORMAM (atestados Arrais/Motonauta, declaração de residência, requerimento) a partir de turma, funil, inbox e contato.

**Architecture:** HTML/CSS tipográfico → Playwright PDF → R2 → `generated_documents`. UI Operate nas superfícies existentes (`GenerateDocumentDialog`).

**Tech Stack:** Next.js 16, Playwright, R2 (`putR2Object`), Supabase RLS, Vitest, next-intl pt-BR.

**Spec:** `docs/superpowers/specs/2026-08-03-habilitation-documents-design.md`

## Global Constraints

- pt-BR; disclaimer NORMAM na UI
- Sem Zod; validação manual em `src/lib/documents/`
- Assinatura fora do app; fidelidade visual = QA humano
- Gerar = admin+; `npm run typecheck` + vitest do módulo

## File map

| Path | Role |
|------|------|
| `supabase/migrations/064_generated_documents.sql` | Tabela + `process_templates.habilitation_kind` |
| `src/lib/documents/types.ts` | Kinds, payloads, `TEMPLATE_VERSION` |
| `src/lib/documents/validate.ts` | Gaps e body da API |
| `src/lib/documents/resolve-kind.ts` | arrais/motonauta a partir do template |
| `src/lib/documents/templates/*.ts` | HTML por kind |
| `src/lib/documents/render-pdf.ts` | Playwright print |
| `src/lib/documents/generate.ts` | Orquestra validate → HTML → PDF → R2 → insert |
| `src/lib/storage/bucket-map.ts` | `buildGeneratedDocumentKey` |
| `src/app/api/documents/**` | generate, list, download |
| `src/app/api/classes/[id]/documents/atestados/route.ts` | Lote |
| `src/components/documents/generate-document-dialog.tsx` | Dialog compartilhado |
| UI: turma, process-detail, contact, inbox | Wire ações |
| `messages/pt-BR.json` | `Documents.*` |

---

### Task 1: Migration + tipos + validação

**Files:** migration 064; `src/lib/documents/{types,validate,resolve-kind}.ts` + testes; key R2; tipo `GeneratedDocument` em `@/types` se houver barrel.

- [ ] Migration aplicada (local file + remoto)
- [ ] `DOCUMENT_KINDS`, payloads mínimos, `validateResidenceContact`, `validateAtestadoContext`
- [ ] `resolveHabilitationKind(template): 'arrais' | 'motonauta' | null` via `habilitation_kind` ou nome
- [ ] `npx vitest run src/lib/documents/*.test.ts` PASS

### Task 2: Templates HTML + render PDF

**Files:** `src/lib/documents/templates/{atestado-arrais,atestado-motonauta,declaracao-residencia,requerimento}.ts`; `render-pdf.ts`; dep `playwright`; `.env.local.example` note.

- [ ] HTML A4 espelhando anexos (estrutura/campos)
- [ ] `renderHtmlToPdf(html): Promise<Buffer>`
- [ ] Smoke test: HTML contém títulos dos anexos
- [ ] `npx playwright install chromium` no setup local

### Task 3: Serviço generate + APIs

**Files:** `generate.ts`; `POST /api/documents/generate`; `GET /api/documents`; `GET /api/documents/[id]/download`; `POST /api/classes/[id]/documents/atestados`.

- [ ] Auth admin+; filtro `account_id`
- [ ] Upload R2 + insert; reemitir = novo id
- [ ] Lote: um PDF por enrollment; relatório ok/erro

### Task 4: UI turma + dialog

**Files:** `generate-document-dialog.tsx`; `agenda/turmas/[id]/page.tsx`; i18n.

- [ ] Fechar: dialog Fechar e gerar / Só fechar
- [ ] Gerar lote + individual / reemitir
- [ ] Lista de emissões na turma

### Task 5: UI funil + contato + inbox

**Files:** `process-detail-sheet` (ou equivalente); contato; inbox sidebar; quick-start grava `habilitation_kind`.

- [ ] Bloco Documentos no processo (requerimento + residência + lista)
- [ ] Residência no contato e inbox
- [ ] Presets Arrais/Motonauta setam `habilitation_kind` no create

### Task 6: Verify

- [ ] typecheck + vitest documents
- [ ] Spec status → `implementado`
- [ ] QA visual manual dos 4 PDFs (checklist no spec)

---

**Execution:** inline nesta sessão (usuário: “ok pode iniciar”).
