# Tabela no catálogo + desconto e código no PDV — Implementation Plan

> **For agentic workers:** Execute task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Catálogo em tabela; PDV com desconto (R$/%) no carrinho e código sequencial por conta (`#000042`).

**Architecture:** Migration 045 adiciona colunas em `sales` + `account_sale_counters` + RPC `allocate_sale_code`. `prepareSale` calcula subtotal/desconto/total. UI do catálogo espelha Contatos; PDV ganha bloco de desconto e exibe o código.

**Tech Stack:** Next.js 16, Supabase, shadcn Table/Select, Vitest, next-intl pt-BR.

## Global Constraints

- pt-BR em copy; BRL via `formatCurrency` / `formatNumber`
- Auth: `requireRole` / `getCurrentAccount`; filtrar `account_id`
- Validação sem Zod; estoque de produto continua inteiro
- Sem impressão de cupom nesta fatia

## File map

| Arquivo | Papel |
|---------|--------|
| `supabase/migrations/045_sale_code_discount.sql` | Schema + backfill + RPC |
| `src/lib/sales/code.ts` | `formatSaleCode` |
| `src/lib/sales/confirm.ts` | Desconto no prepare |
| `src/app/api/sales/route.ts` | Aloca código + persiste |
| `src/types/index.ts` | `DiscountType`, campos em `Sale` |
| `src/app/(dashboard)/catalog/page.tsx` | Tabela |
| `src/app/(dashboard)/pos/page.tsx` | UI desconto + código |
| `messages/pt-BR.json` | Chaves novas |

---

### Task 1: Migration 045

- [ ] Criar `045_sale_code_discount.sql` (contador, colunas nullable → backfill → NOT NULL, UNIQUE, RPC `allocate_sale_code`)
- [ ] Aplicar no remoto via MCP Supabase

### Task 2: Lib + testes (TDD)

- [ ] Testes `formatSaleCode` e desconto em `prepareSale`
- [ ] Implementar até passar

### Task 3: Tipos + API

- [ ] Atualizar `Sale` / `DiscountType`
- [ ] POST `/api/sales` chama RPC e grava campos; GET já devolve `*`

### Task 4: Catálogo tabela

- [ ] Reescrever listagem com `Table` padrão Contatos

### Task 5: PDV UI + i18n

- [ ] Desconto Nenhum/R$/%, resumo, toast `#code`, histórico
- [ ] Chaves em `pt-BR.json`

### Task 6: Verify

- [ ] `npm run typecheck` + lint dos arquivos + `vitest run src/lib/sales`
