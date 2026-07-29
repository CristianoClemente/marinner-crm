# Fatia 2 — Host → tenant + cookies + white-label Implementation Plan

> **For agentic workers:** implementar task-by-task. Steps usam checkbox (`- [ ]`) para tracking.

**Goal:** Resolver a escola pelo Host, compartilhar sessão entre apex e subdomínios, e mostrar nome/logo/favicon no login/join sem flash.

**Architecture:** Middleware parseia Host (ou `x-tenant-slug` em dev) → lookup `accounts.slug` → headers `x-tenant-*`. Cookies Supabase com `domain=.DOMAIN_BASE`. Auth UI e metadata leem `getRequestTenant()`.

**Tech Stack:** Next.js 16 middleware, Supabase SSR + service role, Vitest.

**Spec:** [`docs/superpowers/specs/2026-07-29-account-branding-slice2-design.md`](../specs/2026-07-29-account-branding-slice2-design.md)

## Global Constraints

- Idioma UI e commits: pt-BR
- White-label: só nome + logo (sem cor por conta)
- Dev: Host `slug.localhost` + header `x-tenant-slug` só em `development` no apex
- Auth API: `requireRole` / `getCurrentAccount` — nunca auth manual
- Sem Zod; validação manual
- Headers `x-tenant-*` só o middleware define (sempre sobrescreve)

## File map

| Arquivo | Responsabilidade |
|---------|------------------|
| `src/lib/domain.ts` (+ test) | `parseHost`, `getAuthCookieDomain`, cookie options |
| `src/lib/tenant/headers.ts` | Nomes dos headers + tipo `RequestTenant` |
| `src/lib/tenant/lookup.ts` (+ test cache/shape) | Lookup slug via admin + cache |
| `src/lib/tenant/request.ts` | `getRequestTenant()` via `headers()` |
| `src/lib/supabase/{client,server}.ts` | `cookieOptions.domain` |
| `src/middleware.ts` (+ test) | Resolve tenant, 404/www, membership 403, cookies |
| `src/app/escola-nao-encontrada/page.tsx` | 404 amigável (ou `not-found` tenant) |
| `src/app/sem-acesso/page.tsx` | 403 tenant errado |
| `src/components/auth/login-form.tsx` (+ signup/etc.) | Prop `brand` |
| `src/app/(auth)/**/page.tsx`, `join/**` | Passar brand + metadata icons |
| `src/app/layout.tsx` | Icons dinâmicos se possível via headers |
| Invitations | Preferir `getTenantUrl(slug)` |
| `docs/dominio-e-urls.md` | S12/S13/S14 atualizados |

---

### Task 1: parseHost + cookie domain

**Files:**
- Modify: `src/lib/domain.ts`
- Modify: `src/lib/domain.test.ts`

- [x] **Step 1:** Testes — apex localhost, `escola.localhost:3000`, `escola.marinner.com.br`, `app.` / `www.` / `admin.`, porta, host sem base
- [x] **Step 2:** Implementar:
  - `parseHost(host: string): { kind: "apex" } | { kind: "www" } | { kind: "reserved"; sub: string } | { kind: "tenant"; slug: string }`
  - `getAuthCookieDomain(): string | undefined`
  - `getAuthCookieOptions()` → `{ domain?, path: "/", sameSite: "lax", secure: boolean }`
- [x] **Step 3:** Vitest PASS

---

### Task 2: Tenant headers + lookup + getRequestTenant

**Files:**
- Create: `src/lib/tenant/headers.ts`
- Create: `src/lib/tenant/lookup.ts`
- Create: `src/lib/tenant/lookup.test.ts`
- Create: `src/lib/tenant/request.ts`
- Preferir admin client compartilhado (`@/lib/flows/admin-client` ou extrair `@/lib/supabase/admin` se necessário)

- [x] **Step 1:** Constantes de header + tipo `RequestTenant`
- [x] **Step 2:** `lookupTenantBySlug(slug)` com cache 60s; retorna `{ id, name, slug, logo_url } | null`
- [x] **Step 3:** `getRequestTenant()` lê `headers()` do Next
- [x] **Step 4:** Testes do cache / miss (mock fetch/admin)

---

### Task 3: Cookies Supabase cross-subdomain

**Files:**
- Modify: `src/lib/supabase/client.ts`
- Modify: `src/lib/supabase/server.ts`
- Modify: `src/middleware.ts` (cookie options no createServerClient)

- [x] **Step 1:** Aplicar `getAuthCookieOptions()` em browser + server + middleware `setAll`
- [x] **Step 2:** typecheck

---

### Task 4: Middleware Host → tenant

**Files:**
- Modify: `src/middleware.ts`
- Modify: `src/middleware.test.ts`

- [x] **Step 1:** Resolver slug (Host ou header dev)
- [x] **Step 2:** `www` → redirect apex; reserved → rewrite/redirect página escola-não-encontrada ou 404
- [x] **Step 3:** Lookup; miss → redirect `/escola-nao-encontrada`
- [x] **Step 4:** Hit → set request headers `x-tenant-*` (via `NextResponse.next({ request: { headers } })`)
- [x] **Step 5:** Rotas protegidas + user + tenant: se profile.account_id ≠ tenant.id → `/sem-acesso`
- [x] **Step 6:** Usuário em `/login` no apex: se account.slug → redirect `getTenantUrl(slug)/dashboard` (opcional nesta task ou Task 6)

---

### Task 5: Páginas 404 / 403

**Files:**
- Create: `src/app/escola-nao-encontrada/page.tsx`
- Create: `src/app/sem-acesso/page.tsx`
- Modify: `messages/pt-BR.json`

- [x] **Step 1:** UI simples pt-BR + link `getApexUrl()`
- [x] **Step 2:** i18n keys

---

### Task 6: White-label auth + pós-login

**Files:**
- Modify: login/signup/forgot forms + pages
- Modify: `src/app/join/[token]/page.tsx`
- Modify: invitations URL builder se aplicável

- [x] **Step 1:** `getRequestTenant()` nas pages server → prop `brand`
- [x] **Step 2:** Forms usam brand ou Marinner
- [x] **Step 3:** Pós-login híbrido via `GET /api/account` + `getTenantUrl`
- [x] **Step 4:** Convites preferem URL do tenant quando houver slug

---

### Task 7: Favicon server-side

**Files:**
- Modify: auth layout ou root `generateMetadata`
- Optionally: `src/app/api/tenant/icon/route.ts` (302)

- [x] **Step 1:** Metadata icons = `logo_url` do tenant ou `DEFAULT_FAVICON_SRC`
- [x] **Step 2:** Manter `AccountFavicon` no dashboard

---

### Task 8: Docs + verificação

**Files:**
- Modify: `docs/dominio-e-urls.md`
- Modify: spec status → implementado (quando done)
- Modify: este plano (checks)

- [x] **Step 1:** Documentar Host + header + cookies + checklist DNS
- [x] **Step 2:** `npm run typecheck` + vitest dos módulos novos
- [x] **Step 3:** Marcar checks

---

## Spec coverage

| Requisito | Task |
|-----------|------|
| parseHost / cookie domain | 1 |
| lookup + getRequestTenant | 2 |
| Cookies cross-subdomain | 3 |
| Middleware + 404/403 membership | 4–5 |
| White-label login/join + redirect híbrido | 6 |
| Favicon server-side | 7 |
| Docs DNS / local | 8 |
