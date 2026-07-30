# Catálogo, estoque e PDV (Fatia 1) — Implementation Plan

> **For agentic workers:** Implementar task-by-task. Steps usam checkbox (`- [ ]`) para tracking. Spec: `docs/superpowers/specs/2026-07-29-catalog-pos-stock-design.md`.

**Goal:** Catálogo unificado (produto/serviço), estoque só em produto, PDV com contato opcional e forma de pagamento — sem alterar o funil de negócios.

**Architecture:** Tabelas `catalog_items`, `stock_movements`, `sales`, `sale_items` com RLS `is_account_member`. Libs em `src/lib/catalog` e `src/lib/sales`. APIs thin + UI `/catalog` e `/pos`.

**Tech Stack:** Next.js 16, Supabase (Postgres + RLS), next-intl, Vitest, shadcn/ui.

**Status:** Implementado (2026-07-29). Migration `043` aplicada no projeto `marinner-crm`.

## Global Constraints

- pt-BR em UI/commits; BRL; `NUMERIC(12,2)` preços; `NUMERIC(12,3)` qty estoque
- Auth: `requireRole` / `getCurrentAccount` — nunca manual
- Sem Zod; type guards + validadores em `src/lib/**`
- Serviço nunca gera movimento de estoque; saldo nunca fica negativo
- Soft-delete (`active=false`) se item já vendeu; funil intocado
- Mobile: `ui-responsiva.mdc` (`overflow-x-hidden` em corpos roláveis de modal)

## File map

| Arquivo | Responsabilidade |
|---------|------------------|
| `supabase/migrations/043_catalog_pos_stock.sql` | Schema + RLS |
| `src/types/index.ts` | `CatalogItem`, `StockMovement`, `Sale`, `SaleItem` |
| `src/lib/catalog/validate.ts` + `.test.ts` | Kind, sku, preço, payload create/patch |
| `src/lib/catalog/stock.ts` + `.test.ts` | Regras de movimento / saldo |
| `src/lib/sales/confirm.ts` + `.test.ts` | Montar linhas + baixas (puro) |
| `src/app/api/catalog/route.ts` | GET/POST |
| `src/app/api/catalog/[id]/route.ts` | GET/PATCH/DELETE |
| `src/app/api/catalog/[id]/stock/route.ts` | GET histórico / POST ajuste |
| `src/app/api/sales/route.ts` | GET/POST |
| `src/app/api/sales/[id]/route.ts` | GET |
| `src/app/(dashboard)/catalog/page.tsx` + components | UI catálogo |
| `src/app/(dashboard)/pos/page.tsx` + components | PDV + histórico |
| `src/components/layout/sidebar.tsx` | Nav |
| `messages/pt-BR.json` | Copy |

---

### Task 1: Migration

**Files:** Create `supabase/migrations/043_catalog_pos_stock.sql`

- [ ] Tabelas + constraints + índices (spec)
- [ ] RLS: select `is_account_member`; insert/update/delete catálogo `admin`; movements insert `admin` (ajustes) — vendas via API service/admin path: sales insert `agent`, movements de sale criados na mesma API com cliente autenticado — policy: insert movement se `agent` quando `reason=sale` OU `admin` para adjustments. Mais simples: insert movements `agent+` (admin inclui); API restringe reason por role.
- [ ] FK sales.contact_id ON DELETE SET NULL; sale_items → catalog_items / sales

---

### Task 2: Tipos + validação catálogo (TDD)

**Files:** `src/types/index.ts`, `src/lib/catalog/validate.ts`, `src/lib/catalog/validate.test.ts`, `src/lib/catalog/stock.ts`, `src/lib/catalog/stock.test.ts`

- [ ] Tipos exportados no barrel
- [ ] `parseCatalogKind`, `normalizeSku`, `validateCatalogCreate`, `validateStockAdjustment`
- [ ] `applyMovementToQty(current, qty) → { ok, next }` rejeita negativo
- [ ] Vitest PASS

---

### Task 3: Lógica pura de confirmação de venda (TDD)

**Files:** `src/lib/sales/confirm.ts`, `src/lib/sales/confirm.test.ts`

- [ ] Input: itens do carrinho + catálogo resolvido → output: sale rows + stock deltas (só products)
- [ ] Rejeita inativo, serviço com stock attempt, saldo insuficiente
- [ ] Vitest PASS

---

### Task 4: API catálogo + stock

**Files:** rotas `/api/catalog/**`

- [ ] GET lista (filtros kind/active/q), POST create (+ initial movement se product qty>0)
- [ ] GET/PATCH/DELETE por id
- [ ] GET/POST stock
- [ ] typecheck

---

### Task 5: API sales

**Files:** `/api/sales`, `/api/sales/[id]`

- [ ] POST confirma venda atômica (insert sale, items, movements, update stock_qty)
- [ ] GET lista + GET by id com items
- [ ] typecheck

---

### Task 6: UI Catálogo

**Files:** page + `src/components/catalog/*`, i18n, sidebar link

- [ ] Lista, filtros, dialog create/edit, bloco estoque em produto
- [ ] Mobile-safe

---

### Task 7: UI PDV + histórico

**Files:** page + `src/components/pos/*`, i18n, sidebar link

- [ ] Carrinho, contato opcional, pagamento, confirmar
- [ ] Aba/lista vendas readonly
- [ ] typecheck + lint nos arquivos tocados

---

### Task 8: Aplicar migration remota + verificação

- [ ] `apply_migration` MCP / SQL
- [ ] Smoke manual checklist na spec de sucesso
