# Domínio e URLs — Marinner SaaS

Referência das sprints **S02** (config), **S12** (Host→tenant), **S13** (cookies), **S14** (dev local).

## Apex × tenant (slug)

| Tipo | Exemplo | Uso |
|------|---------|-----|
| **Apex** | `app.marinner.com.br` | Login/signup sem escola no Host; onboarding |
| **Tenant** | `minhaempresa.marinner.com.br` | App da empresa (`accounts.slug = minhaempresa`) |
| **Admin plataforma** | host `admin.…` | Reservado — não é slug de cliente |

```text
                    DOMAIN_BASE = marinner.com.br
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
   app.marinner.com.br   slug.marinner.com.br   www.marinner.com.br
        (apex)                (tenant)              (→ apex)
```

- Middleware (`src/middleware.ts`) resolve o Host, faz lookup por slug e injeta headers `x-tenant-*`.
- Cookie de sessão Supabase usa `domain=.DOMAIN_BASE` (ou `.localhost`) para valer no apex e no tenant.
- Pós-login no apex: se a account tem `slug`, redirect para `getTenantUrl(slug)/dashboard`.

## Variáveis de ambiente

| Variável | Obrigatória? | Exemplo prod | Exemplo local |
|----------|--------------|--------------|---------------|
| `NEXT_PUBLIC_APP_NAME` | recomendada | `Marinner` | `Marinner` |
| `DOMAIN_BASE` | recomendada (SaaS) | `marinner.com.br` | `localhost` |
| `NEXT_PUBLIC_SITE_URL` | recomendada | `https://app.marinner.com.br` | `http://localhost:3000` |
| `ALLOWED_INVITE_HOSTS` | opcional | `app.marinner.com.br,escola.marinner.com.br` | — |

Helpers: [`src/lib/domain.ts`](../src/lib/domain.ts) — `parseHost()`, `getAuthCookieDomain()`, `getTenantUrl()`, etc.

## Produção — checklist DNS / TLS

- [ ] Domínio `marinner.com.br` no registrador
- [ ] Registro **A/AAAA** ou **CNAME** para `app` → origin do Next.js
- [ ] **Wildcard** `*.marinner.com.br` → mesmo origin
- [ ] Certificado TLS cobrindo `app` e `*.marinner.com.br`
- [ ] `NEXT_PUBLIC_SITE_URL=https://app.marinner.com.br`
- [ ] `DOMAIN_BASE=marinner.com.br`
- [ ] Cookies com `domain=.marinner.com.br` (já no código via `getAuthCookieOptions`)
- [ ] Webhooks Meta / Asaas em URL pública estável (preferir apex)

## Local (S14)

```env
DOMAIN_BASE=localhost
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=Marinner
```

### Opção A — Host `slug.localhost:3000`

Chrome/Edge costumam resolver `*.localhost` → `127.0.0.1`.

Ex.: `http://escola.localhost:3000/login` (a account precisa ter `slug=escola`).

### Opção B — Header (fallback em development)

Só no apex (`localhost:3000`), com `NODE_ENV=development`:

```bash
curl -H "x-tenant-slug: escola" http://localhost:3000/login
```

Extensões de browser (ModHeader etc.) também funcionam. Se o Host já traz slug, o Host ganha e o header é ignorado.

### Cookies locais

Em local o cookie é **host-only** (sem `Domain=.localhost`): vários browsers rejeitam
esse Domain no host `localhost`, e a sessão “loga e volta pro login”.

- Use `http://localhost:3000` (não o IP da rede, ex. `192.168.x.x`).
- Tenant local: header `x-tenant-slug` no apex, ou login separado em `slug.localhost`.
- Se a sessão ainda falhar, limpe cookies do site e tente de novo.

## Erros

| Caso | Comportamento |
|------|----------------|
| Slug inexistente / reservado (`admin`, `api`, `mail`) | Redirect para apex `/escola-nao-encontrada` |
| `www.` | Redirect para apex |
| Usuário logado no tenant de outra account | `/sem-acesso` no Host atual |

## Relação com o plano

- Spec Fatia 2: [`superpowers/specs/2026-07-29-account-branding-slice2-design.md`](./superpowers/specs/2026-07-29-account-branding-slice2-design.md)
- Plano: [`superpowers/plans/2026-07-29-account-branding-slice2.md`](./superpowers/plans/2026-07-29-account-branding-slice2.md)
