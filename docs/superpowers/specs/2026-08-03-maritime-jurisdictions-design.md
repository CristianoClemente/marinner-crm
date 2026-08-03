# Design: Jurisdições marítimas (OM/STA) por escola

**Data:** 2026-08-03  
**Status:** implementado (v1) — migration + seed remoto (69 OMs); UI/API no app  
**Abordagem:** 1 — catálogo global + vínculos por conta  
**UI (Settings):** aba própria Jurisdições + Dialog  
**Epic:** escola náutica / documentos de habilitação

## Norte

A escola declara **em quais Capitanias/Delegacias/Agências (OM/STA) atua**, com **um responsável (membro da conta)** por jurisdição e **e-mail de destino opcional**. Locais de aula apontam para uma jurisdição do catálogo; atestados resolvem responsável automaticamente via local → OM → vínculo da conta. Limite de jurisdições vem do plano (Starter 1 · Pro 3 · Business ilimitado).

Catálogo oficial não é editável pela escola. Envio automático de e-mail fica para automação futura (ligar/desligar); o vínculo só guarda override opcional.

## Decisões fechadas

| Tema | Decisão |
|------|---------|
| Catálogo | Tabela global `maritime_authorities` (seed a partir de `docs/om_sta_rows.csv`) |
| Nome legado | Dados de `om_sta`; nome canônico no Marinner: `maritime_authorities` |
| Vínculo escola | `account_jurisdictions` (account × authority × responsável × email_override) |
| Responsável | Membro da conta (`profiles` / `responsible_user_id`) |
| E-mail | Catálogo imutável; override opcional no vínculo; efetivo = override ?? catálogo |
| Matriz demanda→e-mail | Fora da v1 |
| Planos | `features.max_jurisdictions`: starter `1`, pro `3`, business `null` (ilimitado) |
| Local de aula | `class_locations.authority_id` → `maritime_authorities` (opção A) |
| Validação local | Só authority que a conta já vinculou em `account_jurisdictions` |
| Atestado | Resolve via turma.local → authority → vínculo → profile; sem escolha manual no dialog |
| Default na conta | `is_default` só atalho de UI (ex. pré-selecionar ao criar local); **não** fallback do PDF |
| Remover vínculo | Bloquear se algum local da conta ainda aponta para aquela authority |
| Escopo UI v1 | Configurações (aba Jurisdições) + campo jurisdição no form de locais + atestados |
| Fora v1 | Automação de envio; jurisdição no funil/requerimento; editar catálogo pela escola |

## Schema

### `maritime_authorities`

Catálogo nacional (read-only para o tenant).

| Coluna | Tipo | Notas |
|--------|------|--------|
| id | INTEGER PK | IDs explícitos no seed (`1`…`69`); sem serial automático no insert |
| sigla | TEXT NOT NULL UNIQUE | Ex.: `CPSP` |
| nome | TEXT NOT NULL | |
| logradouro, cidade, uf, cep | TEXT | `cep` / telefone / email nullable onde faltar no seed |
| telefone, email | TEXT NULL | |
| created_at, updated_at | TIMESTAMPTZ | |

RLS: `SELECT` para `authenticated`; writes só migração / service role.

Seed canônico: `docs/om_sta_rows.csv` (UTF-8; colunas `id,sigla,nome,logradouro,cidade,uf,cep,telefone,email,criado_em,atualizado_em` → `created_at`/`updated_at` no Postgres). O arquivo `docs/om_sta_rows.sql` é legado e não deve ser a fonte de novas atualizações.

### `account_jurisdictions`

| Coluna | Tipo | Notas |
|--------|------|--------|
| id | UUID PK | |
| account_id | UUID → accounts | |
| authority_id | INT → maritime_authorities | |
| responsible_user_id | UUID → profiles.user_id (auth) | Deve ser membro da account |
| email_override | TEXT NULL | |
| is_default | BOOLEAN NOT NULL DEFAULT false | No máx. um `true` por account |
| created_at, updated_at | TIMESTAMPTZ | |

Constraints:

- `UNIQUE (account_id, authority_id)`
- Índice parcial único para default: um `is_default = true` por `account_id`
- RLS multi-tenant via `account_id` (padrão `is_account_member`)

### `class_locations`

- `ADD COLUMN authority_id INT NULL REFERENCES maritime_authorities(id)`
- Coluna nullable no DB só para não quebrar linhas legadas no deploy
- **Create/update** via API e form: `authority_id` **obrigatório** (deve existir em `account_jurisdictions` da conta)
- Locais legados com `authority_id` null: editáveis só após escolher jurisdição; geração de atestado bloqueada até completar

### Billing

Atualizar seed/`features` dos planos:

```json
"max_jurisdictions": 1   // starter
"max_jurisdictions": 3   // pro
"max_jurisdictions": null // business = ilimitado
```

`Entitlements` / `computeEntitlements` expõem `maxJurisdictions: number | null`.

## APIs

| Método | Rota | Uso |
|--------|------|-----|
| GET | `/api/maritime-authorities` | Catálogo; query `q`, `uf` |
| GET | `/api/account/jurisdictions` | Lista vínculos + join authority + responsible |
| POST | `/api/account/jurisdictions` | Cria; checa `max_jurisdictions`; valida membership do responsável |
| PATCH | `/api/account/jurisdictions/[id]` | Responsável, email_override, is_default |
| DELETE | `/api/account/jurisdictions/[id]` | 409 se local da conta usa a authority |
| PATCH | `/api/class-locations` / `[id]` | Aceita `authority_id`; 400 se não houver vínculo |

Auth: reads para members; writes jurisdições **admin+**; locais seguem regra já existente do módulo.

E-mail efetivo (helper server): `email_override?.trim() || authority.email`.

## UI — Configurações (shape)

**Modo:** Operate · autoridade visual = Settings / DESIGN.md.

- Bloco **Escola** (junto de marca/conta), seção **Jurisdições** — não aba solta na nav
- Meta: “N de M” (M = limite ou “ilimitado”)
- Lista densa: sigla · cidade/UF · responsável · e-mail efetivo · badge Padrão
- **Dialog** add/edit: busca OM → membro responsável → e-mail opcional → marcar padrão
- Empty: CTA + uma frase do porquê (atestados / OM)
- Limite: Adicionar disabled + hint de upgrade
- Tipografia L1/L2/L3 de Settings; botões `h-8`; toast sonner

### Locais de aula

- Campo **Jurisdição** (select só das vinculadas; se nenhuma, link para Configurações)
- Pré-selecionar `is_default` quando houver

### Atestados

- Pipeline: `location.authority_id` → `account_jurisdictions` → `profiles`
- Sem authority no local ou sem vínculo → erro claro; sem PDF parcial
- `SchoolDocumentFields` / payload: incluir `responsibleName` (+ snapshot authority sigla/nome)
- Cada emissão (incl. reemitir) **re-resolve** local → vínculo → responsável e grava **novo** snapshot em `generated_documents.payload`

## Critérios de aceite

1. Catálogo seedado (~69 OMs); escola não altera e-mail/endereço do catálogo.
2. Conta vincula jurisdições até o limite do plano; Business sem teto numérico.
3. Responsável é membro; e-mail efetivo = override ou catálogo.
4. Local exige/usa `authority_id` das vinculadas; delete de vínculo bloqueado se local depende.
5. Atestado traz nome do responsável derivado do local, sem seletor de jurisdição no dialog de gerar.
6. UI Settings na aba Jurisdições + Dialog; typecheck/lint do escopo passam.

## Fora de escopo (v1)

- Automação “enviar e-mail à Capitania”
- Matriz demanda → e-mail
- Jurisdição no processo/requerimento
- CRUD do catálogo pela escola / console plataforma (além de migração)

## Relação com o produto

- Locais: `047_class_locations.sql` + UI `/class-locations`
- Documentos: `2026-08-03-habilitation-documents-design.md`
- Billing: `060_billing_plans_subscriptions.sql` + `@/lib/billing/entitlements`
- Shape UI: brief Impeccable “jurisdições” (2026-08-03)
