# Fatia 1 — Identidade da escola (Settings + shell) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans ou implementar task-by-task. Steps usam checkbox (`- [ ]`) para tracking.

**Goal:** Permitir que admin configure nome, logotipo e slug da escola no Settings, e que sidebar/header/favicon mostrem essa identidade na sessão atual — sem middleware de Host ainda.

**Architecture:** Colunas `slug` + `logo_url` em `accounts`; bucket Storage `account-branding` (path `account-<uuid>/…`); `PATCH /api/account` aceita `name`/`slug`/`logo_url`; painel Aparência ganha bloco "Marca da escola" (admin) acima do tema do dispositivo; `useAuth` carrega os novos campos; sidebar usa logo+nome; favicon da aba usa `logo_url` no dashboard (cliente).

**Tech Stack:** Next.js 16, Supabase (Postgres + Storage + RLS), next-intl, Vitest.

**Status:** Concluído (2026-07-29). Migrations `041` e `042` aplicadas no projeto `marinner-crm`. Favicon incluso via logo.

**Fora de escopo (Fatia 2):** middleware Host→tenant, cookies cross-subdomain, white-label em login/join, DNS wildcard, **favicon server-side por subdomínio** (hoje só no dashboard autenticado).

## Global Constraints

- Idioma UI e commits: pt-BR
- Slug: minúsculas, `[a-z0-9-]+`, 3–48 chars, sem reservados (`app|www|admin|api|mail`)
- Preview URL via `getTenantUrl(slug)` de `@/lib/domain`
- Upload logo: admin+, ≤2 MB, png/jpeg/webp/gif
- Favicon Fatia 1: reutiliza `logo_url` (sem coluna separada)
- Tema claro/escuro continua em localStorage (dispositivo)
- Auth API: `requireRole` / `getCurrentAccount` — nunca manual
- Sem Zod; validação manual + helpers em `src/lib/**`

## File map

| Arquivo | Responsabilidade |
|---------|------------------|
| `supabase/migrations/042_account_branding.sql` | Colunas + bucket + RLS |
| `src/lib/account/slug.ts` + `.test.ts` | Normalizar/validar slug |
| `src/types/index.ts` | `Account.slug`, `logo_url` |
| `src/lib/auth/account.ts` | Contexto com slug/logo |
| `src/hooks/use-auth.tsx` | `AccountSummary` + select |
| `src/app/api/account/route.ts` | PATCH name/slug/logo_url |
| `src/components/settings/branding-panel.tsx` | UI marca (nome/logo/slug) |
| `src/components/settings/appearance-panel.tsx` | Compor branding + tema |
| `src/components/layout/sidebar.tsx` | Logo + nome da escola |
| `src/components/layout/account-favicon.tsx` | Favicon da aba = `logo_url` no dashboard |
| `src/app/(dashboard)/dashboard-shell.tsx` | Monta `AccountFavicon` |
| `messages/pt-BR.json` | Copy |

---

### Task 1: Migration branding

**Files:**
- Create: `supabase/migrations/042_account_branding.sql`

- [x] **Step 1:** Adicionar `slug TEXT NULL` + `logo_url TEXT NULL` em `accounts`
- [x] **Step 2:** `UNIQUE` parcial/`UNIQUE (slug)` (Postgres permite vários NULL)
- [x] **Step 3:** Constraint de formato slug + comentário sobre reservados (validação fina no app)
- [x] **Step 4:** Bucket `account-branding` público, 2 MB, imagens; RLS write admin via path `account-<account_id>/…` (espelhar 020)
- [ ] **Step 5:** Commit `chore(db): slug logo e bucket account-branding` *(pendente — usuário pede commit)*

---

### Task 2: Helper de slug + testes

**Files:**
- Create: `src/lib/account/slug.ts`
- Create: `src/lib/account/slug.test.ts`

- [x] **Step 1:** Testes — normalize, valid, reserved, length
- [x] **Step 2:** Implementar `normalizeSlug`, `validateSlug` (usa `isReservedSubdomain`)
- [x] **Step 3:** Vitest PASS
- [ ] **Step 4:** Commit `feat(account): validacao de slug` *(pendente)*

---

### Task 3: Tipos + auth context

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/lib/auth/account.ts`
- Modify: `src/hooks/use-auth.tsx`

- [x] **Step 1:** `Account` + `AccountContext.account` + `AccountSummary` com `slug` e `logo_url` (nullable)
- [x] **Step 2:** Selects incluem `slug, logo_url`
- [x] **Step 3:** typecheck parcial

---

### Task 4: API PATCH /api/account

**Files:**
- Modify: `src/app/api/account/route.ts`

- [x] **Step 1:** Body opcional `{ name?, slug?, logo_url? }` — ao menos um campo
- [x] **Step 2:** Validar name (já existe), slug via helper, logo_url string|null
- [x] **Step 3:** Tratar unique violation slug → 409 pt-BR
- [x] **Step 4:** GET/retorno com `id, name, slug, logo_url`
- [ ] **Step 5:** Commit `feat(api): atualizar marca da conta` *(pendente)*

---

### Task 5: UI Marca + redesign Aparência

**Files:**
- Create: `src/components/settings/branding-panel.tsx`
- Modify: `src/components/settings/appearance-panel.tsx`
- Modify: `messages/pt-BR.json`

- [x] **Step 1:** Bloco marca: preview logo, upload/remover (padrão profile-form + `uploadAccountMedia`), nome, slug + preview `getTenantUrl`
- [x] **Step 2:** Admin edita; demais veem read-only
- [x] **Step 3:** Aparência: head atualizado; branding acima; modo/tema abaixo
- [x] **Step 4:** i18n `Settings.appearance` + `Settings.branding`
- [ ] **Step 5:** Commit `feat(settings): painel marca da escola` *(pendente)*

---

### Task 6: Sidebar / shell

**Files:**
- Modify: `src/components/layout/sidebar.tsx`

- [x] **Step 1:** Marca do topo: `logo_url` se houver, senão ícone atual; texto = `account.name` (fallback i18n Marinner)
- [ ] **Step 2:** Commit `feat(layout): sidebar com logo da escola` *(pendente)*

---

### Task 8: Favicon da escola

**Files:**
- Create: `src/components/layout/account-favicon.tsx`
- Modify: `src/app/(dashboard)/dashboard-shell.tsx`
- Modify: `messages/pt-BR.json` — hint do logo menciona favicon

**Decisão Fatia 1:** sem coluna `favicon_url` separada — o mesmo `logo_url` alimenta sidebar e favicon (YAGNI). Upload dedicado / crop quadrado fica para depois se precisar.

- [x] **Step 1:** Componente cliente que atualiza `<link rel="icon">` quando `account.logo_url` existe; fallback `/icon` (Marinner)
- [x] **Step 2:** Montar no `DashboardShell` (só sessão autenticada)
- [x] **Step 3:** Hint no painel de marca
- [ ] **Step 4:** Commit *(pendente)*

**Fatia 2 (nota):** com Host→tenant, servir favicon no servidor (login/join/apex tenant) sem depender do cliente — ex.: rota dinâmica ou `metadata` por slug.

---

### Task 7: Verificação

- [x] **Step 1:** `npm run typecheck`
- [x] **Step 2:** `npx vitest run src/lib/account/slug.test.ts`
- [x] **Step 3:** `npm run lint` nos paths tocados (sem regressões novas)
- [x] **Step 4:** Marcar checks neste plano
- [ ] **Step 5:** Commit/push só se o usuário pedir

---

## Spec coverage

| Requisito | Task | Status |
|-----------|------|--------|
| `slug` + `logo_url` no DB | 1 | ✅ |
| Bucket logo | 1 | ✅ |
| Validação slug | 2 | ✅ |
| Auth/UI leem marca | 3 | ✅ |
| Salvar marca (API) | 4 | ✅ |
| Settings redesenhado | 5 | ✅ |
| Sidebar com logo/nome | 6 | ✅ |
| Favicon = logo no dashboard | 8 | ✅ |
| Favicon server-side por Host | Fatia 2 | — |
| Sem Host middleware | (fora) | — |
| Migration aplicada no projeto remoto | ops | ✅ |
