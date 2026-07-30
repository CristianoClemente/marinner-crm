# Design: Estorno de vendas no PDV (Fatia 2)

**Data:** 2026-07-29  
**Status:** implementado (código + migration 046 aplicada)  
**Abordagem:** A — `sale_refunds` + `sale_refund_items` + status na venda  
**Base:** Fatia 1 catálogo/estoque/PDV + desconto/código (`045`)

## Decisões do produto

| Tema | Decisão |
|------|---------|
| Escopo | Estorno **total e parcial** de vendas do PDV |
| Funil / deal_items | **Fora** (fica Fatia 3+) |
| Quem estorna | Qualquer `agent+` da conta |
| Prazo | **Sem prazo** |
| Desconto no parcial | **Proporcional** ao subtotal das linhas estornadas |
| Código da venda | Não muda; `#000042` permanece no histórico |
| Motivo | Texto opcional (`note`) |

## Problema

Erros de caixa e desistência do cliente exigem devolver itens ao estoque e registrar quanto foi devolvido, sem apagar o cupom. Hoje a venda é imutável.

## Arquitetura

```text
sales (status: confirmed | partially_refunded | cancelled)
  ├─ sale_items
  └─ sale_refunds
        └─ sale_refund_items
              └─ stock_movements (reason = sale_refund, qty > 0)
```

### Migration (nova, após 045)

1. `sales.status TEXT NOT NULL DEFAULT 'confirmed'`  
   CHECK IN (`confirmed`, `partially_refunded`, `cancelled`)  
   Backfill: todas existentes → `confirmed`

2. `sale_refunds`  
   - `id`, `account_id` FK, `sale_id` FK ON DELETE RESTRICT  
   - `refunded_by` UUID NOT NULL → `auth.users(id)`  
   - `note` TEXT NULL  
   - `subtotal_refunded`, `discount_refunded`, `total_refunded` NUMERIC(12,2) NOT NULL ≥ 0  
   - CHECK `discount_refunded <= subtotal_refunded`  
   - `created_at`  
   - Índices: `(account_id, created_at DESC)`, `(sale_id)`

3. `sale_refund_items`  
   - `id`, `refund_id` FK CASCADE  
   - `sale_item_id` FK, `catalog_item_id` FK  
   - `qty` NUMERIC — nesta fatia tratado como **inteiro** na API (alinha ao estoque)  
   - `unit_price`, `line_total` NUMERIC(12,2)  
   - CHECK `qty > 0`, `line_total >= 0`

4. `stock_movements`  
   - Estender CHECK de `reason` com `sale_refund`  
   - `refund_id UUID NULL` FK → `sale_refunds(id)` ON DELETE SET NULL

5. RLS: select para membros; insert refunds/items para `agent+` (mesmo padrão de `sales` insert).

### Componentes

| Peça | Responsabilidade |
|------|------------------|
| Migration `046_…` | Schema + backfill status |
| `src/lib/sales/refund.ts` | `prepareRefund` (puro) |
| `POST /api/sales/[id]/refund` | Persistência + estoque + status |
| `GET /api/sales/[id]` | Inclui refunds e qty restante por linha |
| `/pos` histórico | Badges, dialog de estorno |
| Tipos `@/types` | `SaleStatus`, `SaleRefund`, `SaleRefundItem` |

### Regras de negócio

**Qty restante** de uma `sale_item`:  
`qty_remaining = sale_item.qty − SUM(sale_refund_items.qty WHERE sale_item_id)`

**prepareRefund(input):**

1. Venda deve existir e `status ≠ cancelled`.  
2. Se `lines` vazio/omitido → estorno de **toda** qty restante de todas as linhas.  
3. Cada linha: `sale_item_id` da venda; `qty` inteiro > 0 e ≤ `qty_remaining`.  
4. `subtotal_refunded` = soma `round(unit_price * qty, 2)`.  
5. Desconto proporcional:  
   - Se `sale.subtotal = 0` → `discount_refunded = 0`  
   - Senão `discount_refunded = round(sale.discount_amount * subtotal_refunded / sale.subtotal, 2)`  
   - Se este estorno **zera** todas as qtys restantes da venda (incluindo as deste request), ajustar `discount_refunded` para o **desconto ainda não estornado** (`sale.discount_amount − SUM(refunds.discount_refunded)`), evitando residual de centavos.  
6. `total_refunded = subtotal_refunded − discount_refunded` (≥ 0).  
7. Status pós-estorno: se alguma qty restante > 0 → `partially_refunded`; senão → `cancelled`.

**Estoque:** só itens com `kind = product` geram `stock_movements` com `qty = +qty` estornada, `reason = sale_refund`, `sale_id`, `refund_id`.

**Idempotência:** não há chave de idempotência nesta fatia; double-submit do dialog é mitigado por disable do botão + qty restante (segundo request falha se qty esgotou).

## UI

### Histórico PDV

- Badge: Confirmada / Parcial / Cancelada.  
- Cancelada: estilo atenuado.  
- Menu/ação **Estornar** se `status ≠ cancelled` e `useCan` de vender (`agent+`).  
- Mostrar `#code` como hoje.

### Dialog de estorno

- Título com código formatado.  
- Linhas com qty restante; seleção + stepper (default = restante).  
- “Estornar tudo”.  
- Motivo opcional.  
- Preview subtotal / desconto / total a devolver.  
- Confirmar → toast; recarrega histórico (e catálogo se produtos voltaram ao estoque).

### Detalhe expandido

- **Fora do mínimo:** badges + dialog bastam. GET detalhe já devolve refunds para uso futuro.

## APIs

| Método | Rota | Role |
|--------|------|------|
| POST | `/api/sales/[id]/refund` | agent |
| GET | `/api/sales/[id]` | viewer — + `refunds`, `items` com `qty_refunded` / `qty_remaining` (calculados) |
| GET | `/api/sales` | viewer — inclui `status` |

Validação: type guards manuais. Multi-tenant: `account_id`.

### Erros

| Caso | Status |
|------|--------|
| Já cancelada | 409 |
| qty inválida / > restante | 400 |
| Item não pertence à venda | 400 |
| Venda inexistente / outra conta | 404 |
| Sem role agent | 403 |

## Testes

- Unit `prepareRefund`: parcial + desconto proporcional; último estorno ajusta centavos; total → cancelled; rejeita qty excessiva; serviço sem delta de estoque.  
- Regressão: `prepareSale` inalterado.

## Fora de escopo

- `deal_items` / funil  
- Gateway, NF, comprovante impresso de estorno  
- Prazo máximo para estornar  
- Estorno parcial de desconto “manual” (operador escolhe valor)

## Sucesso

1. Agent estorna venda inteira; status `cancelled`; estoque dos produtos volta.  
2. Agent estorna só algumas unidades; status `partially_refunded`; desconto proporcional; pode estornar o resto depois.  
3. Histórico mostra código, status e permite nova ação até cancelar por completo.  
4. Funil permanece sem itens de linha.
