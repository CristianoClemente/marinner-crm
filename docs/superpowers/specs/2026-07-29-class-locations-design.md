# Design: Locais de Aula (Fatia 1)

**Data:** 2026-07-29  
**Status:** implementado (código + migration 047 aplicada)  
**Abordagem:** A — CRUD de locais + despesa + regras de bônus **genéricas por local**

## Decisões do produto

| Tema | Decisão |
|------|---------|
| Escopo | Locais + despesa do local + bônus genérico; **sem** Alunos/Instrutores/Cursos |
| Bônus | Opção B (tabela própria); nesta fatia só regra do local (`instructor`/`course` depois) |
| Endereço | Estruturado (padrão Contatos) |
| Permissões | Agent+ lê; Admin+ cria/edita/exclui |
| Naming DB | Inglês snake_case (`class_locations`); UI pt-BR |
| Soft-delete | `status = inactive` (DELETE da API faz soft) |
| Moeda | BRL; `NUMERIC(12,2)` |

## Problema

Escolas precisam cadastrar onde ocorrem aulas práticas/teóricas, com custo do local (despesa) e eventual bônus ao instrutor. Alunos/Instrutores/Cursos ainda não existem no Marinner; o módulo de locais não pode depender dessas FKs nesta fatia.

## Arquitetura

```text
account
  └─ class_locations
        └─ class_location_bonus_rules  (genéricas nesta fatia)
```

### Migration `047_class_locations.sql`

**`class_locations`**

| Coluna | Tipo | Notas |
|--------|------|--------|
| `id` | uuid PK | `gen_random_uuid()` |
| `account_id` | uuid NOT NULL FK accounts | |
| `name` | text NOT NULL | |
| `endereco`, `numero`, `complemento`, `bairro`, `cidade`, `estado`, `cep` | text NULL | igual Contatos |
| `status` | text NOT NULL DEFAULT `'active'` | CHECK `active` \| `inactive` |
| `has_expense` | boolean NOT NULL DEFAULT false | |
| `expense_type` | text NULL | CHECK: `monthly_fee` \| `per_class` \| `per_day` \| `per_student` |
| `expense_amount` | NUMERIC(12,2) NULL | ≥ 0 |
| `created_at` / `updated_at` | timestamptz | trigger `update_updated_at_column` se existir |

CHECK composto:

- `has_expense = false` → `expense_type IS NULL AND expense_amount IS NULL`
- `has_expense = true` → ambos NOT NULL e `expense_amount >= 0`

Índices: `(account_id, name)`, `(account_id, status)`.

RLS: SELECT membros da conta; INSERT/UPDATE/DELETE `admin+` (mesmo padrão de `catalog_items`).

**`class_location_bonus_rules`**

| Coluna | Tipo | Notas |
|--------|------|--------|
| `id` | uuid PK | |
| `account_id` | uuid NOT NULL | |
| `location_id` | uuid NOT NULL FK → class_locations ON DELETE CASCADE | |
| `bonus_type` | text NOT NULL | mesmos 4 valores de `expense_type` |
| `bonus_amount` | NUMERIC(12,2) NOT NULL ≥ 0 | |
| `starts_on` | date NOT NULL DEFAULT CURRENT_DATE | |
| `ends_on` | date NULL | NULL = sem fim; CHECK `ends_on IS NULL OR ends_on >= starts_on` |
| `active` | boolean NOT NULL DEFAULT true | |
| `created_at` / `updated_at` | timestamptz | |

Índice: `(location_id, active, starts_on)`.

**Fora do schema desta fatia (documentado):** `instructor_id`, `course_id` opcionais + precedência  
`local+instrutor+curso` → `local+instrutor` → `local+curso` → `local`.

### Componentes

| Peça | Responsabilidade |
|------|------------------|
| Migration `047_…` | Tabelas, CHECKs, RLS, índices |
| `src/lib/class-locations/validate.ts` | Create/patch local + create/patch regra |
| `src/lib/class-locations/resolve-bonus.ts` | Resolve regra vigente (puro) |
| `src/app/api/class-locations/**` | REST |
| `/class-locations` | Listagem + form + seção bônus |
| Tipos `@/types` | `ClassLocation`, `ClassLocationBonusRule`, enums |
| `messages/pt-BR.json` | `ClassLocations.*` |
| Sidebar | Item após Catálogo |

### API

| Método | Rota | Auth |
|--------|------|------|
| GET | `/api/class-locations` | agent+ (`?status=`, `?q=`) |
| GET | `/api/class-locations/[id]` | agent+ (inclui `bonus_rules`) |
| POST | `/api/class-locations` | admin+ |
| PATCH | `/api/class-locations/[id]` | admin+ |
| DELETE | `/api/class-locations/[id]` | admin+ → soft (`inactive`) |
| GET | `/api/class-locations/[id]/bonus-rules` | agent+ |
| POST | `/api/class-locations/[id]/bonus-rules` | admin+ |
| PATCH | `/api/class-locations/[id]/bonus-rules/[ruleId]` | admin+ |
| DELETE | `/api/class-locations/[id]/bonus-rules/[ruleId]` | admin+ → soft (`active=false`) |
| GET | `/api/class-locations/[id]/bonus/resolve?on=YYYY-MM-DD` | agent+ |

`resolve` (Fatia 1): entre regras do local com `active=true` e `starts_on ≤ on ≤ ends_on` (ou `ends_on` null), escolher a de `starts_on` mais recente; se empate, a mais recente por `created_at`. Sem regra → `{ bonus: null }`.

### UI

- Listagem tabela (padrão Catálogo): Nome · Cidade · Status · Despesa (chip tipo+valor ou “Sem despesa”) · ações
- Busca por nome/cidade; filtro Ativo/Inativo/Todos
- Form: nome, endereço estruturado, status; switch `has_expense` habilita tipo + valor
- Após criar/ao editar: seção **Regras de bônus** (lista, adicionar, editar vigência/valor, desativar)
- Mobile: botões ícone + form em Dialog sem swipe lateral (padrão do sistema)

### Testes

- Local `has_expense=false` rejeita tipo/valor preenchidos
- Local `has_expense=true` exige tipo + valor ≥ 0
- Resolve: regra vigente aplicada; regra expirada / ainda não iniciada / `active=false` ignorada
- Precedência futura: teste documentado ou skip até FKs existirem (nesta fatia só genérica)

## Fora de escopo (próximas fatias)

- Módulos Instrutores / Cursos / Alunos / Turmas
- Colunas `instructor_id` / `course_id` e precedência completa
- Vínculo de aula/agenda ao local
- Lançamento financeiro automático da despesa/bônus
- Import CSV de locais

## Success criteria

1. Admin cria local com e sem despesa; Agent lista e abre detalhe
2. Admin adiciona regra de bônus com vigência; resolve na data correta
3. Migration aplicada; `typecheck` + `lint` + testes do lib passam
4. Item visível na sidebar em pt-BR
