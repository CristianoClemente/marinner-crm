# Sprints SaaS B2B Marinner — por nível de complexidade

Documento operacional derivado de [`plano-saas-b2b.md`](./plano-saas-b2b.md) e [`perguntas-saas-b2b.md`](./perguntas-saas-b2b.md).

**Como ler**
- Sprints agrupadas por **complexidade** (não só por ordem cronológica).
- Dentro de cada nível, a ordem sugerida de execução está numerada.
- Estimativas em **dias úteis de 1 dev full-stack** (ordem de grandeza).
- Dependências cruzadas estão marcadas com →.

**Legenda de complexidade**

| Nível | Significado |
|-------|-------------|
| **L1 — Baixa** | UI/copy, env, seeds; pouco risco de schema/auth |
| **L2 — Média** | Migration + APIs + gates no app existente |
| **L3 — Alta** | Integração externa, webhooks, estados financeiros |
| **L4 — Muito alta** | Multi-tenant por Host, cookies, isolamento, DNS |

---

## Mapa rápido: sprint × complexidade × fase do plano

| Sprint | Nome | Complexidade | Fase plano | Estimativa |
|--------|------|--------------|------------|------------|
| S01 | Marca Marinner na superfície | L1 | 0 | 1–2 d |
| S02 | Env, domínio e docs de URL | L1 | 0 | 0,5–1 d |
| S03 | Schema `empresas` + plans + subscriptions | L2 | 1 | 2–3 d |
| S04 | Onboarding empresa + slug | L2 | 1 | 2–3 d |
| S05 | Entitlements e gates de plano | L2 | 1 | 3–4 d |
| S06 | Banner trial / inadimplência (UI) | L1 | 1 | 1 d |
| S07 | Cliente Asaas + sandbox | L3 | 2 | 2–3 d |
| S08 | Checkout no signup + trial 14d | L3 | 2 | 3–5 d |
| S09 | Webhooks Asaas → status | L3 | 2 | 3–4 d |
| S10 | Settings Assinatura / faturas | L2 | 2 | 2–3 d |
| S11 | Soft/hard block por status | L2 | 2 | 2 d |
| S12 | Resolver tenant por Host | L4 | 3 | 4–6 d |
| S13 | Cookies, redirects apex→slug | L4 | 3 | 2–3 d |
| S14 | Dev local multi-tenant | L2 | 3 | 1–2 d |
| S15 | White-label logo/cores | L2–L3 | 4 | 3–4 d |
| S16 | Console `/admin` plataforma | L3 | 5 | 4–5 d |
| S17 | Hardening, e2e, go-live checklist | L3 | — | 3–4 d |

**Ordem cronológica sugerida (MVP):**  
S01 → S02 → S03 → S04 → S05 → S06 → S07 → S08 → S09 → S10 → S11 → S12 → S13 → S14 → S15 → S16 → S17

---

# L1 — Complexidade baixa

## Sprint S01 — Marca Marinner na superfície ✅

**Objetivo:** usuário só vê “Marinner” nas telas e metadados.

**Escopo**
- [`src/app/layout.tsx`](../src/app/layout.tsx): `title` / `description`
- `messages/pt-BR.json` (e demais locales se ainda usados na UI): strings com nome do produto
- Sidebar, login, signup, e-mails transacionais (se templates no repo)
- Favicon / `app/icon` se ainda for genérico

**Fora de escopo**
- (nenhum — package npm alinhado a `marinner-crm`)

**Critérios de aceite**
- [x] `/login` e `/dashboard` exibem Marinner
- [x] Aba do browser: título Marinner
- [x] Sem menções legadas ao nome antigo do fork na UI

**Feito:** `src/lib/brand.ts` (`APP_NAME` / `NEXT_PUBLIC_APP_NAME`); i18n pt-BR; signup; convites; erro WhatsApp; fallback de invite → `app.marinner.com.br`. Prefixos API `marinner_live_` e headers `X-Marinner-*`.

**Estimativa:** 1–2 dias  
**Dependências:** nenhuma

---

## Sprint S02 — Env, domínio e documentação de URL ✅

**Objetivo:** base de config para apex vs tenant.

**Escopo**
- `.env.local.example`: `NEXT_PUBLIC_APP_NAME`, `DOMAIN_BASE`, `NEXT_PUBLIC_SITE_URL`
- Atualizar [`docs/plano-saas-b2b.md`](./plano-saas-b2b.md) ou README com:
  - Produção: `app.marinner.com.br` + `*.marinner.com.br`
  - Local: estratégia escolhida na S14
- Wildcard DNS (checklist ops — não precisa estar live ainda)

**Critérios de aceite**
- [x] Variáveis documentadas
- [x] Time sabe diferença apex × slug

**Feito:** [`docs/dominio-e-urls.md`](./dominio-e-urls.md); [`src/lib/domain.ts`](../src/lib/domain.ts) + testes; env example/local; fallback de convites via `getApexUrl()`.

**Estimativa:** 0,5–1 dia  
**Dependências:** S01 (pode ser paralelo)

---

## Sprint S06 — Banner trial / inadimplência (UI)

**Objetivo:** feedback visual do estado comercial.

**Escopo**
- Componente no shell do dashboard: “Faltam X dias no trial”
- Banner `past_due`: “Pagamento pendente — envios bloqueados”
- Link para Settings → Assinatura (S10)

**Critérios de aceite**
- [ ] Owner/admin vê banner correto por `accounts.status`
- [ ] Viewer também vê (somente leitura)

**Estimativa:** 1 dia  
**Dependências:** S03 (status no account); ideal após S05

---

# L2 — Complexidade média

## Sprint S03 — Schema: `empresas` + plans + subscriptions

**Objetivo:** modelo de dados SaaS no Supabase com tabela **`empresas`** como identidade comercial/visual (não poluir `accounts` com branding/billing).

**Spec detalhada:** [`docs/schema-empresas-s03.md`](./schema-empresas-s03.md)

**Escopo (migration)**
- Tabela **`empresas`** 1:1 com `accounts` (`account_id` UNIQUE):
  - identidade: `slug`, `nome_fantasia`, `razao_social`, `cnpj`, contato
  - visual: `logo_url`, `primary_color`, `favicon_url`
  - SaaS: `status` (`trialing`…`suspended`), `trial_ends_at`
  - prefs: `default_locale`, `timezone`, `default_currency` (BRL), `settings` JSONB
- Tabela **`plans`** + seed Starter / Pro / Business (preços placeholder, `max_seats`, `features`)
- Tabela **`subscriptions`** ligada a **`empresa_id`** + `plan_id` + campos Asaas vazios
- Backfill: cada `accounts` existente → `empresas` (slug a partir do nome) + subscription ativa
- RLS: members leem empresa/plano/assinatura da própria account; billing write via service role
- Types TS: `Empresa`, `Plan`, `Subscription`
- **Não** migrar FKs de domínio (`contacts`, etc.) para `empresa_id` nesta sprint — continua `account_id`

**Critérios de aceite**
- [ ] Migration aplica limpa em projeto novo e em DB com dados
- [ ] Toda account legada tem exatamente 1 `empresas`
- [ ] Slug único; conflito de nome tratado no backfill
- [ ] Types TS atualizados (`src/types`)

**Estimativa:** 2–3 dias  
**Dependências:** S02 (convenção de slug + reservados)

---

## Sprint S04 — Onboarding: nome da empresa + slug

**Objetivo:** self-serve cria **empresa** (`empresas`) como `owner` com slug escolhido.

**Escopo**
- Fluxo pós-signup: `nome_fantasia` + `slug` → grava em `empresas` (account já existente ou criada no fluxo)
- API `GET /api/empresas/slug-available?slug=` (ou `/api/account/…` alias)
- Validação: kebab-case, min/max, reserved (`app`, `www`, `admin`, `api`, `mail`…)
- Ajuste do trigger / onboarding: garantir `accounts` + `empresas` + `subscriptions` (trial)
- Redirect pós-onboarding para dashboard (ainda sem subdomínio até S12)

**Critérios de aceite**
- [ ] Novo usuário termina onboarding com `empresas.slug` único
- [ ] Slug reservado rejeitado com mensagem PT-BR
- [ ] Usuário vira `owner` da account vinculada à empresa

**Estimativa:** 2–3 dias  
**Dependências:** S03

---

## Sprint S05 — Entitlements e gates de plano

**Objetivo:** plano flat com teto de seats (e features mínimas).

**Escopo**
- `src/lib/billing/entitlements.ts`: `getEntitlements(accountId)` → `{ plan, maxSeats, features, status }`
- `requireBillableAccount(event)` / helper que falha se `past_due`/`canceled`/`suspended` (regras finas na S11)
- Gate em convites: bloquear se `members >= max_seats`
- Gate feature flags simples via `plans.features` (ex.: `api_keys`, `broadcasts`)
- UI Settings → Membros: aviso “Plano permite até N usuários”

**Critérios de aceite**
- [ ] Convite acima do teto retorna 403 + toast PT-BR
- [ ] Feature desligada no plano Starter não aparece / API rejeita

**Estimativa:** 3–4 dias  
**Dependências:** S03; S04 para fluxo real

---

## Sprint S10 — Settings: Assinatura e faturas

**Objetivo:** owner gerencia plano/status no painel.

**Escopo**
- Aba Settings “Assinatura”
- Mostra plano atual, status, trial_ends_at, próximo vencimento (quando Asaas existir)
- Ações: trocar plano (chama API S08), abrir link de pagamento Asaas
- Somente `owner` (e opcionalmente `admin`)

**Critérios de aceite**
- [ ] Owner vê estado coerente com DB
- [ ] Agent/viewer não alteram billing

**Estimativa:** 2–3 dias  
**Dependências:** S03; melhor após S08/S09

---

## Sprint S11 — Soft block e hard block

**Objetivo:** comportamento por status comercial.

| Status | Leitura CRM | Envio WA / broadcast | Convites | Billing settings |
|--------|-------------|----------------------|----------|------------------|
| `trialing` / `active` | sim | sim | sim (se seats) | sim |
| `past_due` | sim | **não** | **não** | sim |
| `canceled` / `suspended` | limitado | **não** | **não** | sim |

**Escopo**
- Aplicar tabela acima em APIs de send/broadcast/invite
- Mensagens de erro claras em PT-BR
- Banner S06 alinhado

**Critérios de aceite**
- [ ] Conta `past_due` não envia mensagem
- [ ] Conta `active` não é afetada

**Estimativa:** 2 dias  
**Dependências:** S05, S06; status real via S09

---

## Sprint S14 — Dev local multi-tenant

**Objetivo:** desenvolver subdomínios sem DNS prod.

**Escopo (escolher uma e documentar)**
- Opção A: `slug.localhost:3000` (quando o SO/resolva)
- Opção B: header `x-tenant-slug` / cookie só em `NODE_ENV=development`
- Opção C: `?tenant=slug` no apex (dev only)

**Critérios de aceite**
- [ ] Dois slugs testáveis localmente sem conflito
- [ ] Doc em `docs/` com o fluxo

**Estimativa:** 1–2 dias  
**Dependências:** S12 (pode começar stub na S12)

---

## Sprint S15 — White-label (logo + cor)

**Objetivo:** Marinner default; empresa personaliza aparência no próprio slug.

**Escopo**
- Upload logo → Storage `account-branding/{account_id}/`
- Campos `logo_url`, `primary_color` no Settings (admin+)
- Layout/sidebar/login no tenant aplicam CSS variables
- Fallback Marinner se vazio

**Critérios de aceite**
- [ ] Tenant A e B com logos diferentes
- [ ] Apex/login sem tenant continua Marinner

**Estimativa:** 3–4 dias  
**Dependências:** S03 campos; S12 para login no slug (pode UI no apex antes)

**Nota:** parte UI é L2; Storage + policies eleva para L3 se RLS de storage for trabalhosa.

---

# L3 — Complexidade alta

## Sprint S07 — Cliente Asaas + ambiente sandbox

**Objetivo:** SDK/HTTP wrapper pronto e credenciais seguras.

**Escopo**
- `src/lib/billing/asaas.ts` (criar customer, subscription, cancel, get payment link)
- Env: `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN`, `ASAAS_ENV=sandbox`
- Mapeamento `plans` ↔ `asaas_price` / id de plano no Asaas (tabela ou config)
- Testes unitários do client com fetch mock

**Critérios de aceite**
- [ ] Criar customer no sandbox via script ou teste de integração
- [ ] Erros Asaas traduzidos para mensagem amigável

**Estimativa:** 2–3 dias  
**Dependências:** S03 (`plans` / `subscriptions`)

---

## Sprint S08 — Checkout no signup + trial 14 dias

**Objetivo:** pagamento obrigatório no cadastro; trial com cartão/token Asaas.

**Escopo**
- Após onboarding (S04): escolher plano → checkout Asaas
- Criar `subscriptions` com `status=trialing`, `trial_ends_at = now+14d`
- Não liberar envios críticos até método de pagamento confirmado (definir regra: “tokenizado” vs “primeira cobrança”)
- Tratamento de abandono de checkout (account incompleta / resume checkout)

**Critérios de aceite**
- [ ] Fluxo sandbox: signup → slug → plano → cartão teste → dashboard
- [ ] Sem pagamento: não fica `active` eterno sem trial controlado

**Estimativa:** 3–5 dias  
**Dependências:** S04, S07

**Risco:** UX de cartão obrigatório + PIX (Asaas); validar no sandbox o fluxo exato (tokenização vs cobrança).

---

## Sprint S09 — Webhooks Asaas → status da conta

**Objetivo:** fonte da verdade financeira via eventos.

**Escopo**
- `POST /api/webhooks/asaas` com validação de token/assinatura
- Eventos: pagamento confirmado, atrasado, assinatura cancelada, estornada
- Idempotência (tabela `billing_events` ou idempotency key)
- Atualiza `subscriptions` + `accounts.status`
- Log estruturado (sem `console.log` de PII; usar logger/tabela)

**Critérios de aceite**
- [ ] Replay do mesmo evento não duplica efeito
- [ ] OVERDUE → `past_due`; CONFIRMED → `active`
- [ ] Teste com payload fixture

**Estimativa:** 3–4 dias  
**Dependências:** S07, S08

---

## Sprint S16 — Console de plataforma `/admin`

**Objetivo:** operar o SaaS sem SQL.

**Escopo**
- Tabela/`platform_admins` ou allowlist de e-mails
- Lista accounts: slug, status, plano, trial, ids Asaas
- Ações: suspender, estender trial, trocar plano, reenviar link de pagamento
- Proteção: middleware role plataforma; audit log simples

**Critérios de aceite**
- [ ] Não-admin recebe 404/403
- [ ] Suspender bloqueia account (S11)
- [ ] Estender trial atualiza `trial_ends_at`

**Estimativa:** 4–5 dias  
**Dependências:** S03, S09, S11

---

## Sprint S17 — Hardening e go-live

**Objetivo:** checklist de produção.

**Escopo**
- Rate limit em signup/checkout/webhooks
- Revisar RLS de `plans` / `subscriptions` / branding
- Wildcard SSL + DNS `*.marinner.com.br`
- Asaas produção + webhook URL pública
- Teste e2e happy path + past_due
- Runbook: “cliente não pagou” / “slug errado” / “webhook falhou”

**Critérios de aceite**
- [ ] Checklist go-live assinado
- [ ] Sandbox e prod documentados

**Estimativa:** 3–4 dias  
**Dependências:** S09, S12–S13, S16 (admin desejável)

---

# L4 — Complexidade muito alta

## Sprint S12 — Resolver tenant pelo Host

**Objetivo:** `minhaempresa.marinner.com.br` → `account_id` correto.

**Escopo**
- Middleware / proxy Next: parse Host → slug → lookup account (cache 5 min)
- Contexto tipado (`getTenantAccount()`)
- Validação cross-tenant: membership do user **e** Host batem no mesmo `account_id`
- Páginas públicas no tenant: login com branding (S15)
- Apex (`app.`, `www.`) sem tenant

**Critérios de aceite**
- [ ] Dois slugs isolados no mesmo deploy
- [ ] User da conta A não acessa dados B mesmo forjando Host (RLS + check)
- [ ] Slug inexistente → 404 amigável

**Estimativa:** 4–6 dias  
**Dependências:** S03 (slug), S04; cookies na S13

**Risco alto:** regressão de auth/session; testar bem com Supabase cookie domain.

---

## Sprint S13 — Cookies, redirects apex → slug

**Objetivo:** sessão única no domínio base; UX de entrada correta.

**Escopo**
- Cookie Supabase com `domain=.marinner.com.br`
- Pós-login no apex: redirect `https://{slug}.{DOMAIN_BASE}/dashboard`
- Convites e magic links apontam para host do slug
- `ALLOWED_INVITE_HOSTS` alinhado

**Critérios de aceite**
- [ ] Login no apex cai no subdomínio certo
- [ ] Sessão válida entre `app.` e `slug.` (se desejado) ou fluxo documentado se sessão for só no tenant

**Estimativa:** 2–3 dias  
**Dependências:** S12

---

# Empacotamento por “ondas” (opcional)

Se quiser lançar em fatias comerciais:

### Onda 1 — SaaS vendável sem subdomínio (menor risco)
S01–S11 (+ Asaas)  
Cliente usa `app.marinner.com.br` com slug só interno.  
**Complexidade pico:** L3

### Onda 2 — Subdomínio + white-label
S12–S15  
**Complexidade pico:** L4

### Onda 3 — Operação
S16–S17  
**Complexidade pico:** L3

---

# Capacidade e riscos

| Risco | Sprints | Mitigação |
|-------|---------|-----------|
| Asaas + cartão obrigatório + PIX | S08 | Spike 1 dia no sandbox antes de fechar UX |
| Cookie multi-subdomínio | S12–S13 | Spike auth cedo; testar staging com wildcard |
| 1 user = 1 account vs 2 empresas | S04 | Decidir se bloqueia 2ª empresa no MVP |
| Preços reais dos planos | S03/S08 | Seed placeholder; trocar sem migration se em config |

**Total bruto (soma das estimativas):** ~40–55 dias úteis (1 dev).  
**Com ondas + 1 dev:** Onda 1 ~4–6 semanas; Onda 2 ~2–3 semanas; Onda 3 ~1–2 semanas.

---

# Definition of Done (todas as sprints)

- [ ] PT-BR na UI tocada
- [ ] Sem `console.log` novo
- [ ] Types em `src/types` / shared alinhados
- [ ] Migration com down-risk documentado (ou só forward)
- [ ] Critérios de aceite da sprint marcados
- [ ] Nada de secret em git

---

## Próximo passo

Começar pela **Onda 1 / L1–L2**: **S01 → S03 → S04 → S05**, em paralelo S02 e S06 quando o schema existir.
