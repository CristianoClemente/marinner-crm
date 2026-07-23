# Progresso — Marinner SaaS (até a Sprint S02)

Documento de acompanhamento do trabalho feito neste repositório (`marinner-crm` / fork wacrm), da preparação do ambiente até as sprints SaaS iniciais.

**Última atualização:** 21/07/2026  
**Branch de trabalho:** `develop`  
**Próxima sprint sugerida:** **S03** (tabela **`empresas`** + `plans` + `subscriptions`) — ver [`schema-empresas-s03.md`](./schema-empresas-s03.md)

---

## Resumo executivo

| Área | Status | Alterou banco? |
|------|--------|----------------|
| MCP Supabase + ambiente dev | Concluído | **Sim** — 36 migrations aplicadas no projeto remoto |
| Branch `develop` no GitHub | Concluído | Não |
| Localização PT-BR (UI) | Concluído | Não |
| Decisões SaaS + plano + sprints | Concluído | Não (só docs) |
| Sprint S01 — Marca Marinner | Concluído | Não |
| Sprint S02 — Domínio / env / docs URL | Concluído | Não |
| Sprint S03+ (planos, Asaas, subdomínio…) | Pendente | **Sim** (previsto na S03) |

---

## Linha do tempo por etapa

### 1. MCP Supabase e modo desenvolvimento

**Objetivo:** conseguir operar o projeto localmente com Cursor + Supabase.

**Feito**
- Configuração do MCP Supabase (`.cursor/mcp.json`)
- `.env.local` com chaves do projeto
- Dev server Next.js (`npm run dev`)

**Banco de dados:** **SIM**  
- As 36 migrations em `supabase/migrations/` (001 → 036) foram aplicadas no projeto Supabase via MCP (`apply_migration`).
- Foi gerado `supabase/_all_migrations.sql` (concatenação) e incluído no `.gitignore` (não versionar dump local).

**Pontos críticos**
- Sem migrations o app sobe, mas auth/RLS/tabelas falham.
- `SUPABASE_SERVICE_ROLE_KEY` e `ENCRYPTION_KEY` são obrigatórios para várias rotas server-side.
- Nunca commitar `.env.local` nem `.cursor/mcp.json` com secrets.

**Falhas e resoluções**

| Falha | Como resolveu |
|-------|----------------|
| Percepção de que migrations não tinham sido aplicadas | Uso do MCP Supabase para aplicar cada migration em ordem |
| PowerShell não aceita `&&` em alguns comandos encadeados | Comandos separados com `;` |

---

### 2. Branch `develop` no GitHub

**Objetivo:** ramificar melhorias sem afetar a linha principal.

**Feito**
- Branch `develop` criada e publicada em `origin`
- Ajustes de `.gitignore` (MCP, dump SQL)

**Banco de dados:** **NÃO** (só git)

**Pontos críticos**
- Autenticação Git no Windows via Git Credential Manager (GCM).

**Falhas e resoluções**

| Falha | Como resolveu |
|-------|----------------|
| `git push` falhou: *Invalid username or token / Password authentication is not supported* | Reautenticação interativa via GCM (login no browser); push concluído depois |
| Tentativa de limpar credential bloqueada por Auto-review | Não forçar erase de credential; novo `git push` disparou o fluxo correto do GCM |
| CLI `gh` ausente no ambiente | Push feito só com `git` |

---

### 3. Localização PT-BR (produto para o Brasil)

**Objetivo:** tudo que o usuário vê em português; código interno pode permanecer em inglês.

**Feito**
- `messages/pt-BR.json` + `NEXT_PUBLIC_APP_LOCALE=pt-BR` + fallback em `src/i18n/request.ts`
- Telas/auth/toasts/hardcoded traduzidos
- Datas/números/`DEFAULT_CURRENCY=BRL` em `src/lib/currency.ts`
- Validações de flows/automations/interactive/send-message em PT-BR
- `translateAuthError` para erros do Supabase Auth
- Ajustes de testes que assertavam strings em inglês

**Banco de dados:** **NÃO**  
(apenas textos de UI, formatadores e mensagens de validação no código)

**Pontos críticos**
- Mensagens de `validate.ts` / `interactive.ts` aparecem no builder — precisam estar em PT-BR.
- Testes unitários acoplados ao texto da mensagem quebram se traduzir sem atualizar asserts.
- Moeda default BRL muda expectativa de formatação (`1.234` vs `1,234`).

**Falhas e resoluções**

| Falha | Como resolveu |
|-------|----------------|
| Testes de `flows/validate`, `automations/validate`, `interactive`, `send-message`, `currency` falhando após tradução | Atualização das asserções para o texto PT-BR / separador `1.234` |
| 2 testes em `date-utils.test.ts` (`mondayIndex`) falhando | **Não corrigidos neste ciclo** — falha pré-existente por fuso (UTC-3): `new Date("YYYY-MM-DD")` vira dia anterior no local. Fora do escopo da i18n |
| Hydration mismatch no `/login` com `cz-shortcut-listen` no `<body>` | Não era bug do app: extensão **ColorZilla**. Solução: `suppressHydrationWarning` no `<body>` em `layout.tsx` |

---

### 4. Decisão de produto SaaS B2B

**Objetivo:** alinhar modelo de negócio antes de implementar billing/subdomínio.

**Feito**
- [`docs/perguntas-saas-b2b.md`](./perguntas-saas-b2b.md) — perguntas com exemplos
- Respostas do time registradas
- [`docs/plano-saas-b2b.md`](./plano-saas-b2b.md) — plano técnico faseado
- [`docs/sprints-saas-b2b.md`](./sprints-saas-b2b.md) — sprints por complexidade (L1–L4)

**Decisões fechadas**

| Tema | Escolha |
|------|---------|
| Modelo | Self-serve hospedado; cliente cria empresa e é `owner` |
| Acesso | `app.marinner.com.br` + `slug.marinner.com.br` |
| Cobrança | Asaas |
| Marca | Marinner + white-label (logo/cores) |
| Preço | Plano flat por empresa |
| WhatsApp | 1 número por conta |
| Trial | Pagamento obrigatório no cadastro (14 dias assumidos) |

**Banco de dados:** **NÃO** (somente documentação)

**Pontos críticos**
- Schema atual: 1 usuário → 1 account (multi-empresa do mesmo dono fica para depois).
- Asaas + cartão no signup exige gateway cedo (S07–S09), não dá para “só UI” por muito tempo.
- Subdomínio (S12–S13) é L4 — deixar para Onda 2 após planos/gates no apex.

**Falhas e resoluções**

| Falha | Como resolveu |
|-------|----------------|
| Pedido “implementar o plano” quando o plano era só o questionário | Materializado como `docs/perguntas-saas-b2b.md` no repo (sem editar o arquivo `.plan` do Cursor) |
| Respostas soltas no meio do markdown | Consolidadas no plano técnico + (parcialmente) no doc de perguntas |

---

### 5. Sprint S01 — Marca Marinner na superfície ✅

**Objetivo:** usuário só vê Marinner, nunca wacrm, na UI.

**Feito**
- `src/lib/brand.ts` (`APP_NAME` / `NEXT_PUBLIC_APP_NAME`)
- Metadata em `layout.tsx`
- Sidebar + strings i18n (pt-BR / en / ko)
- Signup, convites, mensagem de erro WhatsApp
- Fallback de invite apontando para apex Marinner

**Banco de dados:** **NÃO**

**Pontos críticos**
- **Não** renomear prefixo `wacrm_live_` nem headers `X-Wacrm-*` (quebra API/clientes).
- Package npm pode continuar `wacrm`; marca visual é independente.

**Falhas e resoluções**  
Nenhuma falha bloqueante nesta sprint.

---

### 6. Sprint S02 — Env, domínio e docs de URL ✅

**Objetivo:** base de config apex vs tenant (sem resolver Host ainda).

**Feito**
- [`docs/dominio-e-urls.md`](./dominio-e-urls.md)
- [`src/lib/domain.ts`](../src/lib/domain.ts) + testes (3/3 OK)
- `.env.local` / `.env.local.example`: `DOMAIN_BASE`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_APP_NAME`
- Convites usam `getApexUrl()` no fallback
- Links no plano SaaS e no README

**Banco de dados:** **NÃO**  
(slug no Host / `accounts.slug` entram na **S03** + **S12**)

**Pontos críticos**
- Em local: `DOMAIN_BASE=localhost` + `NEXT_PUBLIC_SITE_URL=http://localhost:3000`.
- Wildcard DNS `*.marinner.com.br` é checklist ops — **não** precisa estar live antes da Onda 2.
- Resolução real por subdomínio = S12; cookies cross-subdomain = S13.

**Falhas e resoluções**  
Nenhuma falha bloqueante. Testes de domínio passaram na primeira execução.

---

### 7. Operação do `next dev` (infra local)

**Banco de dados:** **NÃO**

**Falhas e resoluções**

| Falha | Como resolveu |
|-------|----------------|
| Porta 3000 em uso; segundo `next dev` abortava (“Another next dev server is already running”) | `taskkill /PID … /F` no processo antigo; subir um único servidor em `http://localhost:3000` |

---

## O que ainda **não** alterou o banco (e quando vai alterar)

| Trabalho futuro | Migration esperada? | Sprint |
|-----------------|---------------------|--------|
| `accounts.slug`, `status`, `trial_ends_at`, branding | **Sim** | S03 |
| Tabelas `plans` / `subscriptions` | **Sim** | S03 |
| Campos Asaas em subscription | **Sim** (ou mesma migration) | S07–S09 |
| `platform_admins` | **Sim** | S16 |
| Multi-número WhatsApp | Não no MVP | backlog |
| Multi-membership (1 user, N accounts) | Possível | pós-MVP / S12 |

---

## Artefatos de documentação criados

| Arquivo | Papel |
|---------|--------|
| [`docs/perguntas-saas-b2b.md`](./perguntas-saas-b2b.md) | Decisões de produto |
| [`docs/plano-saas-b2b.md`](./plano-saas-b2b.md) | Arquitetura e fases |
| [`docs/sprints-saas-b2b.md`](./sprints-saas-b2b.md) | Sprints por complexidade |
| [`docs/dominio-e-urls.md`](./dominio-e-urls.md) | Apex × tenant, env, DNS |
| [`docs/progresso-saas-ate-aqui.md`](./progresso-saas-ate-aqui.md) | Este relatório |

---

## Riscos abertos (ainda não resolvidos)

1. **Trial em dias** — assumido 14; confirmar comercialmente.  
2. **Preços dos planos** — placeholders Starter/Pro/Business.  
3. **`date-utils.test.ts` / fuso** — flaky no UTC-3; corrigir com datas timezone-safe quando for conveniente.  
4. **Asaas sandbox** — spike obrigatório antes de fechar UX do checkout (S08).  
5. **1 user = 1 account** — pode atrapalhar dono com 2 empresas; decidir antes da S12.

---

## Próximo passo recomendado

Executar **Sprint S03** — primeira etapa que **altera o banco de dados** para o modelo SaaS, com tabela **`empresas`** (identidade visual + status + prefs), mais `plans` e `subscriptions` (não colocar branding direto em `accounts`). Spec: [`schema-empresas-s03.md`](./schema-empresas-s03.md).
