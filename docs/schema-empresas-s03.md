# Schema S03 — Tabela `empresas` (identidade SaaS)

Substitui o desenho anterior que colocava slug/branding/status direto em `accounts`.

## Princípio

| Camada | Tabela | Responsabilidade |
|--------|--------|------------------|
| **Operacional / time** | `accounts` + `profiles` | Membership, roles, owner, RLS (`account_id` nas tabelas de domínio) |
| **Comercial / marca** | `empresas` | Slug, identidade visual, status SaaS, preferências da empresa, vínculo ao plano |
| **Catálogo** | `plans` | Planos flat (Starter / Pro / Business) |
| **Assinatura** | `subscriptions` | Assinatura Asaas da **empresa** |

```text
auth.users
    └── profiles (account_id, account_role)
              └── accounts (1 workspace / time)
                        └── empresas (1:1)  ← slug, logo, status, trial
                                  └── subscriptions → plans
```

**Por que não migrar tudo para `empresa_id` agora?**  
Dezenas de tabelas e políticas RLS usam `account_id`. Na S03 criamos `empresas` 1:1 com `accounts`; na S12 o Host resolve `empresas.slug` → `account_id` para o restante do app. Uma migração massiva de FKs fica para fase posterior (opcional).

---

## Tabelas

### `empresas`

| Coluna | Tipo | Notas |
|--------|------|--------|
| `id` | UUID PK | |
| `account_id` | UUID UNIQUE NOT NULL → `accounts(id)` ON DELETE CASCADE | 1 empresa por account |
| `slug` | TEXT UNIQUE NOT NULL | Subdomínio: `{slug}.marinner.com.br` |
| `nome_fantasia` | TEXT NOT NULL | Nome exibido (UI, sidebar, convites) |
| `razao_social` | TEXT NULL | Opcional (NF / jurídico) |
| `cnpj` | TEXT NULL | Somente dígitos; UNIQUE parcial se preenchido |
| `email_contato` | TEXT NULL | |
| `telefone` | TEXT NULL | |
| `logo_url` | TEXT NULL | White-label (S15) |
| `primary_color` | TEXT NULL | Ex.: `#0F766E` |
| `favicon_url` | TEXT NULL | Opcional |
| `status` | `empresa_status` NOT NULL | ver enum |
| `trial_ends_at` | TIMESTAMPTZ NULL | |
| `default_locale` | TEXT NOT NULL DEFAULT `'pt-BR'` | |
| `timezone` | TEXT NOT NULL DEFAULT `'America/Sao_Paulo'` | |
| `default_currency` | CHAR(3) NOT NULL DEFAULT `'BRL'` | Pode espelhar / substituir uso de `accounts.default_currency` na app |
| `settings` | JSONB NOT NULL DEFAULT `'{}'` | Flags extras sem nova migration (ex.: `{ "onboarding_completed": true }`) |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

**Enum `empresa_status`:**  
`trialing` | `active` | `past_due` | `canceled` | `suspended`

**Constraints de slug**
- `CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')`
- Length 3–48
- Reservados na app (`app`, `www`, `admin`, `api`, `mail`) — validar na API; opcional CHECK com lista

**Índices**
- UNIQUE(`slug`)
- UNIQUE(`account_id`)
- UNIQUE(`cnpj`) WHERE `cnpj IS NOT NULL`

### `plans`

| Coluna | Tipo | Notas |
|--------|------|--------|
| `id` | UUID PK | |
| `code` | TEXT UNIQUE | `starter`, `pro`, `business` |
| `name` | TEXT | Exibição |
| `price_cents` | INT NOT NULL | Placeholder comercial |
| `currency` | CHAR(3) DEFAULT `'BRL'` | |
| `interval` | TEXT NOT NULL DEFAULT `'month'` | `month` \| `year` |
| `max_seats` | INT NOT NULL | Teto de usuários |
| `max_contacts` | INT NULL | NULL = ilimitado |
| `features` | JSONB NOT NULL DEFAULT `'{}'` | Ex.: `{ "api_keys": true, "broadcasts": true, "flows": true }` |
| `asaas_plan_id` | TEXT NULL | Preenchido na S07 |
| `is_active` | BOOLEAN DEFAULT true | |
| `sort_order` | INT DEFAULT 0 | |
| `created_at` | TIMESTAMPTZ | |

**Seed inicial (valores placeholder — ajustar comercialmente)**

| code | name | price_cents | max_seats | features (resumo) |
|------|------|-------------|-----------|-------------------|
| starter | Starter | 19700 | 3 | broadcasts limitados; sem api_keys |
| pro | Pro | 39700 | 10 | automations + flows |
| business | Business | 79700 | 25 | api_keys + limites maiores |

### `subscriptions`

| Coluna | Tipo | Notas |
|--------|------|--------|
| `id` | UUID PK | |
| `empresa_id` | UUID NOT NULL UNIQUE → `empresas(id)` | 1 assinatura “corrente” por empresa no MVP |
| `plan_id` | UUID NOT NULL → `plans(id)` | |
| `status` | TEXT NOT NULL | Alinha com Asaas / espelha parcialmente `empresas.status` |
| `asaas_customer_id` | TEXT NULL | S07+ |
| `asaas_subscription_id` | TEXT NULL | S07+ |
| `current_period_start` | TIMESTAMPTZ NULL | |
| `current_period_end` | TIMESTAMPTZ NULL | |
| `cancel_at_period_end` | BOOLEAN DEFAULT false | |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

---

## Backfill (accounts já existentes)

Para cada `accounts` row sem `empresas`:

1. Criar `empresas` com:
   - `nome_fantasia` = `accounts.name`
   - `slug` = slugify(name) + sufixo se colidir
   - `status` = `'active'` (contas legadas já em uso)
   - `default_currency` = `accounts.default_currency` se existir, senão `BRL`
2. Criar `subscriptions` no plano `pro` (ou `starter`) com `status = 'active'` sem IDs Asaas

Novo signup (S04): trigger / fluxo cria `accounts` → `empresas` (slug escolhido) → `subscriptions` trial.

---

## RLS (resumo)

- **SELECT** `empresas` / `subscriptions` / `plans`: membros da `account_id` vinculada (`is_account_member`)
- **UPDATE** identidade visual / dados cadastrais da empresa: `admin+`
- **UPDATE** `status` / billing fields / `subscriptions`: preferir **service role** (webhooks Asaas, admin plataforma) — app owner só via APIs server que usam service role
- `plans`: leitura autenticada (catálogo); escrita só service role / migration

---

## Types TS (`src/types`)

```ts
export type EmpresaStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'suspended';

export interface Empresa {
  id: string;
  account_id: string;
  slug: string;
  nome_fantasia: string;
  razao_social: string | null;
  cnpj: string | null;
  email_contato: string | null;
  telefone: string | null;
  logo_url: string | null;
  primary_color: string | null;
  favicon_url: string | null;
  status: EmpresaStatus;
  trial_ends_at: string | null;
  default_locale: string;
  timezone: string;
  default_currency: string;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Plan { /* ... */ }
export interface Subscription { /* ... */ }
```

Helpers: `getEmpresaByAccountId`, `getEmpresaBySlug` (S12), entitlements leem `subscriptions` + `plans` via `empresa_id`.

---

## Impacto nas sprints seguintes

| Sprint | Ajuste |
|--------|--------|
| S04 | Onboarding grava `empresas.slug` + `nome_fantasia` |
| S05 | Entitlements por `empresa_id` / join account |
| S06 | Banner usa `empresas.status` / `trial_ends_at` |
| S08–S09 | Asaas amarra em `subscriptions.empresa_id` |
| S12 | Host → `empresas.slug` → `account_id` |
| S15 | White-label lê `logo_url` / `primary_color` de `empresas` |

---

## O que **não** vai em `empresas`

- Membros / roles → `profiles`
- WhatsApp config → `whatsapp_config` (continua `account_id`)
- Contatos, inbox, deals → tabelas atuais com `account_id`
- A antiga coluna `contacts.company` (texto livre do lead) foi removida — **não** confundir com `empresas`
