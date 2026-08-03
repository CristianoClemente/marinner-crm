# Modelos de início rápido para funis — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven-development) task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Galeria de 3 presets (venda + Arrais + Motonauta) em `/process-templates` que pré-preenche o dialog de criação; Salvar usa APIs existentes.

**Architecture:** Catálogo estático em `src/lib/processes/quick-start-templates.ts` (`kind: sale|process`). Página aplica draft via `openCreateFromPreset`. Sem API/migration novas.

**Tech Stack:** Next.js 16, React 19, Vitest, next-intl pt-BR, lucide-react, shadcn Dialog.

**Spec:** `docs/superpowers/specs/2026-08-03-process-template-quick-starts-design.md`

## Global Constraints

- pt-BR only; taxonomia **venda** / **processo** (não comercial×habilitação)
- Sem Zod; sem seed no banco no clique
- Disclaimer NORMAM só em presets de processo
- `npm run typecheck` + vitest do módulo

## File map

| Path | Role |
|------|------|
| `src/lib/processes/quick-start-templates.ts` | Catálogo + tipos + `QUICK_START_ORDER` |
| `src/lib/processes/quick-start-templates.test.ts` | Testes do catálogo |
| `messages/pt-BR.json` | `Processes.templates.quickStart.*` |
| `src/app/(dashboard)/process-templates/page.tsx` | Galeria + `openCreateFromPreset` + hint |

---

### Task 1: Módulo de presets + testes

**Files:**
- Create: `src/lib/processes/quick-start-templates.ts`
- Create: `src/lib/processes/quick-start-templates.test.ts`

**Produces:**
- `QuickStartSlug`, `QuickStartKind`, `QuickStartFieldSeed`, `QuickStartStageSeed`, `QuickStartTemplate`
- `QUICK_START_TEMPLATES`, `QUICK_START_ORDER`, `getQuickStartTemplate(slug)`

- [ ] **Step 1:** Testes falhando (3 slugs, kinds, capabilities, campos Arrais)
- [ ] **Step 2:** Implementar os 3 presets conforme spec
- [ ] **Step 3:** `npx vitest run src/lib/processes/quick-start-templates.test.ts` → PASS
- [ ] **Step 4:** Commit `feat: catálogo de início rápido para funis`

### Task 2: i18n

**Files:** Modify `messages/pt-BR.json` under `Processes.templates.quickStart`

Keys: `title`, `hint`, `hintNormam`, `emptyDesc`, `kind.sale`, `kind.process`, `meta` (`{stages} etapas · {mode} · {kind}`), `mode.free`, `mode.sequential`, por slug `sales_pipeline|arrais_amador|motonauta` → `name`, `description`; nomes de etapas/campos podem viver no seed em pt-BR (copy operacional fixa do preset) **ou** chaves — preferir labels pt-BR no seed (como DEFAULT_STAGES hoje) para não explodir i18n; cards usam i18n para name/description/meta.

- [ ] **Step 1:** Adicionar chaves
- [ ] **Step 2:** Commit `chore(i18n): copy início rápido de funis`

### Task 3: UI galeria + wire dialog

**Files:** Modify `src/app/(dashboard)/process-templates/page.tsx`

- [ ] **Step 1:** Import catálogo + ícones; seção galeria (grid 1/2/3); meta via `t('quickStart.meta', …)`
- [ ] **Step 2:** `openCreateFromPreset(slug)` aplica name, capabilities, stages+fields (com `clientKey`), `fromPreset` state, abre dialog
- [ ] **Step 3:** DialogDescription condicional (hint ± NORMAM); empty state aponta galeria; limpar `fromPreset` em `openCreate`
- [ ] **Step 4:** typecheck; commit `feat: galeria de modelos de início rápido em funis`

### Task 4: Verify + status da spec

- [ ] typecheck + vitest
- [ ] Atualizar status da spec para `implementado`
- [ ] Commit docs se necessário

---

**Execution:** inline nesta sessão (usuário: “pode iniciar”).
