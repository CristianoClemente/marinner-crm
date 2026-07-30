# Design: Tabela no catálogo + desconto e código de venda no PDV

**Data:** 2026-07-29  
**Status:** implementado (código + migration 045 aplicada)  
**Abordagem:** A — extensão mínima da Fatia 1 (sem impressão de cupom)  
**Base:** `2026-07-29-catalog-pos-stock-design.md` (já implementada)

## Decisões do produto

| Tema | Decisão |
|------|---------|
| Catálogo | Lista vira **tabela** no padrão Contatos (só UI) |
| Desconto | Só no **carrinho inteiro** (não por linha) |
| Tipos de desconto | `none` \| `fixed` (R$) \| `percent` (%) |
| Total zero | **Permitido** (cortesia / 100%) |
| Código da venda | Sequencial **por conta**, exibido como `000001` |
| Cupom impresso | **Fora** desta fatia |

## Problema

O catálogo está em lista de cards, fora do padrão tabular do restante do CRM (ex.: Contatos). No PDV não há desconto formal sobre o subtotal nem um número de cupom legível para o balcão — só o UUID interno.

## Arquitetura

```text
account
  ├─ account_sale_counters (account_id → next_code)
  └─ sales
        + code (TEXT, único por conta)
        + subtotal, discount_type, discount_value, discount_amount
        + total (= subtotal − discount_amount)
```

Catálogo: sem mudança de schema — só `/catalog` troca a superfície para `Table`.

### Migration (nova, após 044)

1. `CREATE TABLE account_sale_counters (
     account_id UUID PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
     next_code INTEGER NOT NULL DEFAULT 1 CHECK (next_code >= 1)
   )` + RLS alinhado a `is_account_member`.

2. Em `sales`:
   - `code TEXT NOT NULL` — valor canônico **sem** padding (`"1"`, `"42"`); UI formata com `padStart(6, "0")`.
   - `UNIQUE (account_id, code)`
   - `subtotal NUMERIC(12,2) NOT NULL CHECK (subtotal >= 0)`
   - `discount_type TEXT NOT NULL DEFAULT 'none' CHECK (IN ('none','fixed','percent'))`
   - `discount_value NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (discount_value >= 0)`
   - `discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0)`
   - Manter `total` com CHECK `total >= 0` e `discount_amount <= subtotal`.
   - Igualdade `total = subtotal - discount_amount` **só na API** (`prepareSale`), para não depender de CHECK frágil com arredondamento NUMERIC.

3. **Backfill** de vendas existentes (por `account_id`, ordenadas por `created_at`):
   - Atribuir `code` sequencial a partir de 1
   - `subtotal = total`, `discount_type = 'none'`, `discount_value = 0`, `discount_amount = 0`
   - Inserir/atualizar `account_sale_counters.next_code = MAX(code)+1` (ou 1 se vazio)

### Componentes

| Peça | Responsabilidade |
|------|------------------|
| Migration `045_…` | Colunas + contador + backfill + RLS do contador |
| `src/lib/sales/confirm.ts` | Aceitar desconto; calcular `subtotal`, `discount_amount`, `total` |
| `src/lib/sales/code.ts` (ou helper no confirm) | `formatSaleCode(n)` → `"000042"` |
| `POST /api/sales` | Lock no contador → INSERT sale com `code` → items + stock |
| `/catalog` | Tabela shadcn |
| `/pos` | UI de desconto + resumo + código no toast/histórico |
| Tipos `@/types` | Campos novos em `Sale` |

### Regras de negócio (desconto)

Entrada: `discount_type` + `discount_value` (número ≥ 0).

| type | Cálculo de `discount_amount` |
|------|------------------------------|
| `none` | 0 (ignora `discount_value` ou força 0) |
| `fixed` | `min(discount_value, subtotal)` arredondado a 2 casas |
| `percent` | `round(subtotal * discount_value / 100, 2)` com `discount_value ∈ [0, 100]` |

- `subtotal` = soma das `line_total` (já arredondadas).
- `total` = `subtotal - discount_amount` (≥ 0; pode ser 0).
- Preço unitário editável no carrinho **permanece** (ajuste pontual de linha); o desconto global é adicional e independente.
- Estoque e linhas **não** mudam com o desconto.

### Geração do código

Na mesma transação da venda (service role / admin client já usado):

1. `INSERT INTO account_sale_counters (account_id, next_code) VALUES ($acc, 1) ON CONFLICT DO NOTHING`
2. `UPDATE account_sale_counters SET next_code = next_code + 1 WHERE account_id = $acc RETURNING next_code - 1` (valor alocado)
3. Gravar `sales.code = String(allocated)` (texto do inteiro)
4. UI: `formatSaleCode(code)` → zero-pad 6 dígitos; se passar de 999999, mostra o número completo sem truncar

Cliente **nunca** envia `code`.

## UI

### Catálogo

- `Table` / `TableHeader` / `TableBody` como em Contatos.
- Colunas: Nome · Tipo · SKU · Preço · Estoque · Status (ativo/inativo) · menu de ações.
- Responsivo: esconder SKU / Status / Estoque em breakpoints menores; Nome + Preço + ações sempre.
- Manter busca com debounce, filtro Todos/Produtos/Serviços, `StateCard`, dialogs de form/estoque/exclusão.

### PDV — venda

- Bloco Desconto: segmented `Nenhum | R$ | %` + `Input` (visível só se não for Nenhum).
- Resumo fixo no rodapé do carrinho: Subtotal · Desconto (se > 0) · Total.
- Toast de sucesso: `Venda #000042 registrada` (código formatado).
- Histórico: coluna/prefixo mono `#000042`; chip de desconto se `discount_amount > 0`.

### Fora de escopo (esta fatia)

- Impressão / PDF de cupom
- Busca por código no histórico
- Desconto por linha além do preço unitário editável
- Estorno, NF, gateway

## APIs

| Método | Rota | Mudança |
|--------|------|---------|
| POST | `/api/sales` | Body: `discount_type?`, `discount_value?`; response com `code`, `subtotal`, `discount_*`, `total` |
| GET | `/api/sales` | Incluir novos campos nas linhas |
| GET | `/api/sales/[id]` | Idem |

Validação: type guards manuais em `prepareSale` / validate auxiliar. Role inalterada (`agent` para POST).

### Erros

| Caso | Status |
|------|--------|
| `discount_type` inválido | 400 |
| `percent` fora de 0–100 | 400 |
| `fixed` / value negativo ou não numérico | 400 |
| Demais erros da Fatia 1 | iguais |

## Testes

- Unit: `none` / `fixed` / `percent`; percent 100 → total 0; fixed > subtotal → amount = subtotal; `formatSaleCode`.
- Regressão: venda mista e estoque insuficiente inalterados.
- UI: sem teste E2E obrigatório nesta fatia.

## Sucesso

1. Catálogo legível em tabela no desktop e usável no mobile.
2. Operador aplica desconto R$ ou % no carrinho e vê Subtotal / Desconto / Total.
3. Cada venda nasce com código sequencial da escola; toast e histórico mostram `#000042`.
4. Vendas antigas recebem código no backfill sem quebrar listagens.
