# Domínio e URLs — Marinner SaaS

Referência da Sprint **S02**. A resolução de tenant pelo `Host` (middleware) é a **S12**; o fluxo local completo é a **S14**.

## Apex × tenant (slug)

| Tipo | Exemplo | Uso |
|------|---------|-----|
| **Apex** | `app.marinner.com.br` | Login, signup, onboarding, marketing; sem empresa no Host |
| **Tenant** | `minhaempresa.marinner.com.br` | App da empresa (`accounts.slug = minhaempresa`) |
| **Admin plataforma** | `app.…/admin` ou host `admin.…` (S16) | Console interno Marinner |

```text
                    DOMAIN_BASE = marinner.com.br
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
   app.marinner.com.br   slug.marinner.com.br   www.marinner.com.br
        (apex)                (tenant)              (→ apex)
```

- **Apex** não carrega dados de uma empresa pelo Host.
- **Tenant** isola a sessão/contexto na account cujo `slug` bate com o subdomínio (S12).
- Subdomínios reservados (não podem ser slug de cliente): `app`, `www`, `admin`, `api`, `mail` — ver `APEX_SUBDOMAINS` em [`src/lib/domain.ts`](../src/lib/domain.ts).

## Variáveis de ambiente

| Variável | Obrigatória? | Exemplo prod | Exemplo local |
|----------|--------------|--------------|---------------|
| `NEXT_PUBLIC_APP_NAME` | recomendada | `Marinner` | `Marinner` |
| `DOMAIN_BASE` | recomendada (SaaS) | `marinner.com.br` | `localhost` |
| `NEXT_PUBLIC_SITE_URL` | recomendada | `https://app.marinner.com.br` | `http://localhost:3000` |
| `ALLOWED_INVITE_HOSTS` | opcional | `app.marinner.com.br,*.marinner.com.br`\* | — |

\* Hoje o allow-list compara hostname exato (sem wildcard). Em multi-tenant (S12/S13), listar apex + hosts conhecidos ou evoluir o matcher. Enquanto o slug ainda não está no Host, use o apex.

Helpers: [`src/lib/domain.ts`](../src/lib/domain.ts) — `getDomainBase()`, `getApexUrl()`, `getTenantUrl(slug)`, `isReservedSubdomain()`.

Fallback de convite (quando não dá para derivar o Host): `getApexUrl()` — ver [`src/app/api/account/invitations/route.ts`](../src/app/api/account/invitations/route.ts).

## Produção — checklist DNS / TLS

Antes do go-live com subdomínios (Onda 2 / S12):

- [ ] Domínio `marinner.com.br` no registrador
- [ ] Registro **A/AAAA** ou **CNAME** para `app` → origin do Next.js (Vercel/Hostinger/VPS)
- [ ] **Wildcard** `*.marinner.com.br` → mesmo origin
- [ ] Certificado TLS cobrindo `app` e `*.marinner.com.br` (ou ACME wildcard)
- [ ] `NEXT_PUBLIC_SITE_URL=https://app.marinner.com.br`
- [ ] `DOMAIN_BASE=marinner.com.br`
- [ ] Cookies Supabase com `domain=.marinner.com.br` (S13)
- [ ] Webhook Meta / Asaas apontando para URL pública estável (preferir apex ou path dedicado)

Não é necessário o wildcard estar live para as sprints S03–S11 (Onda 1 usa só o apex; slug fica só no banco).

## Local (prévia da S14)

Até a S14, o dia a dia é:

```env
DOMAIN_BASE=localhost
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=Marinner
```

Estratégias previstas na S14 (escolher uma e documentar o procedimento):

1. **`slug.localhost:3000`** — alguns browsers resolvem `*.localhost` para `127.0.0.1`
2. **Header `x-tenant-slug`** — só em `development`
3. **Query `?tenant=slug`** — só em `development`

Até lá, `getTenantUrl('escola')` já devolve `http://escola.localhost:3000` quando `DOMAIN_BASE=localhost`, mas o middleware ainda não roteia por Host.

## Relação com o plano

- Visão geral: [`plano-saas-b2b.md`](./plano-saas-b2b.md)
- Sprints: [`sprints-saas-b2b.md`](./sprints-saas-b2b.md) — S02 (este doc), S12 (resolver Host), S13 (cookies), S14 (dev local)
