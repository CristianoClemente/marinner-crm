# Design: Fatia 2 — Host → tenant + cookies + white-label público

**Data:** 2026-07-29  
**Status:** implementado (código base Fatia 2)  
**Abordagem:** A — middleware leve + headers de tenant  
**Depende de:** Fatia 1 (`accounts.slug`, `logo_url`, Settings, sidebar, favicon cliente)

## Decisões do produto

| Tema | Decisão |
|------|---------|
| Dev local | Host `slug.localhost:3000` **e** header `x-tenant-slug` só em `development` (fallback no apex) |
| Pós-login no apex | Híbrido: se a account tem `slug` → redirect para `getTenantUrl(slug, "/dashboard")`; senão permanece no apex |
| Slug inexistente | Página **404** amigável (“Escola não encontrada”) |
| Usuário logado em tenant errado | **403** amigável + link para o apex (não troca de conta silenciosa) |
| White-label nesta fatia | Só **nome + logo** (+ favicon server-side). Cor de destaque continua por dispositivo |
| DNS wildcard | Checklist ops em `docs/dominio-e-urls.md` — sem código de DNS |

## Problema

Fatia 1 grava e exibe marca **dentro da sessão autenticada no mesmo host**. Ainda falta:

1. Resolver a escola pelo **Host** (`escola.marinner.com.br`).
2. Compartilhar sessão entre apex e subdomínios (**cookies** `domain=.DOMAIN_BASE`).
3. Mostrar logo/nome/favicon no **login/join** do tenant **sem flash** (server-side).
4. Fluxo local de desenvolvimento sem depender só de DNS de produção.

## Arquitetura

```text
                    DOMAIN_BASE
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
        apex           tenant          reservados
   (app/www/local)   (slug.*)        (admin/api/mail)
          │               │
          │               ├─ lookup accounts.slug (admin)
          │               ├─ headers x-tenant-*
          │               └─ 404 se slug inválido
          │
   login Marinner    login white-label
   cookie .DOMAIN    cookie .DOMAIN (mesma sessão)
```

### Componentes

| Peça | Responsabilidade |
|------|------------------|
| `parseHost` / `resolveTenantSlug` (`src/lib/domain.ts` ou `src/lib/tenant/host.ts`) | Extrai slug do Host vs `DOMAIN_BASE`; apex → `null`; reservados → não-tenant |
| `lookupTenantBySlug` (`src/lib/tenant/lookup.ts`) | Service role: `{ id, name, slug, logo_url }` ou `null`; cache memória ~60s |
| Middleware | Auth (já existe) + resolve tenant + injeta headers + 404 slug; membership check em rotas protegidas no tenant |
| `getAuthCookieDomain()` | `.marinner.com.br` / `.localhost` — usado em middleware, server e browser client |
| `getRequestTenant()` | Lê headers `x-tenant-*` em Server Components / route handlers |
| Auth UI | Login/signup/forgot/join recebem `brand: { name, logoUrl } \| null` |
| Favicon server | `metadata.icons` / rota estável baseada no tenant do Host |
| Docs | Atualizar `docs/dominio-e-urls.md` (S12/S13/S14); checklist DNS |

### Headers internos (após resolve)

Definidos só pelo middleware (não confiar em cliente):

- `x-tenant-slug`
- `x-tenant-account-id`
- `x-tenant-name`
- `x-tenant-logo-url` (pode ser vazio)

Em apex: headers **ausentes** (tenant = null).

### Dev: header `x-tenant-slug`

- Só se `process.env.NODE_ENV === "development"`.
- Só se o Host é apex (`localhost` / `app.…` sem slug).
- Se Host já tem slug, o Host ganha; o header é ignorado.
- Documentar uso (extensão / `curl -H`).

## Cookies e sessão

- Helper `getAuthCookieDomain(): string | undefined`
  - `DOMAIN_BASE === "localhost"` → `.localhost`
  - senão → `.${DOMAIN_BASE}` (ex.: `.marinner.com.br`)
- Passar `cookieOptions: { domain, path: "/", sameSite: "lax", secure: prod }` em:
  - `src/middleware.ts`
  - `src/lib/supabase/server.ts`
  - `src/lib/supabase/client.ts`
- Cookie autentica o **usuário**; Host escolhe a **escola**.
- Migrar cookies antigos sem domain: no primeiro login após deploy o usuário pode precisar reautenticar (aceitável; documentar).

## Auth e membership

### Rotas protegidas no tenant

Após `getUser()` ok:

1. Se há tenant no Host e `profile.account_id !== tenant.accountId` → resposta **403** (página dedicada ou redirect para `/wrong-tenant` com copy pt-BR).
2. Se não há tenant (apex) e rota é protegida → comportamento atual (dashboard no apex permitido **enquanto** account sem slug; com slug, preferir redirect para tenant — ver pós-login).

### Pós-login (híbrido)

1. `signInWithPassword` no client.
2. Se há invite → `/join/{token}` (inalterado; Host do join pode ser apex ou tenant).
3. Senão: `GET /api/account` (ou endpoint mínimo) → se `slug` → `window.location = getTenantUrl(slug, "/dashboard")`; senão → `/dashboard` no host atual.
4. Middleware: usuário já logado visitando `/login` no apex com slug na account → redirect para tenant dashboard (espelha o híbrido).

### Join

- Convite aceito no Host do link. Preferir gerar links de convite com `getTenantUrl(slug)` quando a account tiver slug (ajuste em invitations se ainda usar só apex).
- UI de join no tenant mostra logo/nome da escola do Host (não só ícone genérico).

## White-label público

- Server pages de auth leem `getRequestTenant()`.
- Props para `LoginForm` (e equivalentes): `brand?: { name: string; logoUrl: string | null }`.
- Apex: `brand` omitido → Marinner.
- Sem campo de cor na conta nesta fatia.

## Favicon server-side

- Com tenant + `logo_url`: `metadata.icons` aponta para a URL da logo (ou rota proxy `/api/tenant/icon` que 302 para `logo_url` / default).
- Sem tenant: `DEFAULT_FAVICON_SRC` / `src/app/icon.svg`.
- `AccountFavicon` no dashboard permanece como reforço pós-login.

## Erros (UI)

| Caso | UX |
|------|-----|
| Slug desconhecido | 404 “Escola não encontrada” + link para apex |
| Membro de outra account no tenant | 403 “Você não tem acesso a esta escola” + link apex / logout |
| Reservado (`admin`/`api`/`mail`) no Host | **404** (não é escola). `www` → redirect para apex. `app` = apex |

## Fora de escopo (Fatia 2)

- `primary_color` / tema por account
- Multi-membership (usuário em N empresas) — continua 1 profile → 1 account
- Wildcard DNS / TLS (só doc)
- Billing / Asaas
- Subdomínio obrigatório no signup (onboarding slug pode continuar opcional até o admin salvar na Fatia 1)

## Critérios de aceite

- [ ] `escola.localhost:3000/login` mostra nome/logo da account com esse slug (sem flash Marinner)
- [ ] Header `x-tenant-slug: escola` em `localhost:3000` (dev) resolve a mesma marca
- [ ] Login no apex com account que tem slug redireciona para `getTenantUrl(slug)/dashboard` e a sessão vale no subdomínio
- [ ] Login no apex sem slug permanece no apex
- [ ] Subdomínio inexistente → 404 amigável
- [ ] Usuário da account A em Host da account B → 403 amigável
- [ ] Favicon no login do tenant reflete `logo_url` (ou default Marinner)
- [ ] `npm run typecheck` + testes de `parseHost` / cookie domain / lookup

## Riscos

| Risco | Mitigação |
|-------|-----------|
| Cookie `.localhost` inconsistente em algum browser | Documentar fallback header; testar Chrome/Edge; Firefox se falhar, orientar `slug.localhost` + limpar cookies |
| Lookup slug a cada request | Cache 60s em memória no processo Node |
| Middleware Edge + service role | Usar client `@supabase/supabase-js` compatível ou `fetch` REST; não importar Node-only |
| Headers forjáveis pelo cliente | Middleware **sobrescreve** sempre; APIs que dependem de tenant revalidam via lookup ou comparam com profile |
