# Design: Catálogo, estoque e PDV (Fatia 1)

**Data:** 2026-07-29  
**Status:** implementado (código + migration 043 aplicada)  
**Abordagem:** A — catálogo unificado (`product` | `service`) + movimentos de estoque + vendas PDV

## Decisões do produto

| Tema | Decisão |
|------|---------|
| Escopo da fatia | Catálogo + estoque + PDV; **sem** itens de linha no funil (`deals`) |
| Tipos | Produto físico e serviço no mesmo catálogo (`kind`) |
| Estoque | **Só produtos**; serviços têm preço, nunca quantidade |
| Escolas sem produto | Usam só serviços no catálogo/PDV; UI de estoque some nesses itens |
| Contato no PDV | **Opcional** (venda avulsa ou ligada a contato) |
| Pagamento | Só **forma** (`cash` / `pix` / `card` / `other`) — sem gateway |
| Baixa de estoque | Na **confirmação da venda** (produtos do carrinho) |
| Ajustes manuais | Entrada / saída / correção com motivo + histórico |
| Moeda | BRL; valores `NUMERIC(12,2)` como `deals.value` |
| Funil (Fatia 3+) | Itens no deal + baixa ao ganhar; NF/gateway |

## Problema

Escolas náuticas vendem **serviços** (todas) e, em alguns casos, **produtos físicos**. O CRM hoje tem negócios com um valor único e não tem catálogo, estoque nem ponto de venda. Falta uma base comercial operacional fora do funil, reutilizável depois nos deals.

## Arquitetura

```text
account
  └─ catalog_items (product | service)
        ├─ stock_qty (só product; derivado/atualizado por movimentos)
        ├─ stock_movements (sale | adjustment_* | correction | initial)
        └─ sale_items ──► sales (contact opcional, payment_method)
```

### Componentes

| Peça | Responsabilidade |
|------|------------------|
| Migration `043_catalog_pos_stock.sql` | Tabelas, índices, RLS por `account_id`, constraints |
| `src/lib/catalog/*` | Validação (kind, sku, preço), regras de estoque |
| `src/lib/sales/*` | Confirmar venda (transação: sale + items + movimentos) |
| `/api/catalog`, `/api/catalog/[id]`, `/api/catalog/[id]/stock` | CRUD + ajustes + histórico |
| `/api/sales`, `/api/sales/[id]` | Criar/listar/detalhar vendas |
| `/catalog` | Lista, filtros, formulário produto/serviço |
| `/pos` | PDV (carrinho → confirmação) |
| Sidebar | Links Catálogo e PDV |
| Tipos em `@/types` | `CatalogItem`, `StockMovement`, `Sale`, `SaleItem` |

### Modelo de dados

**`catalog_items`**

- `id`, `account_id` NOT NULL
- `kind` CHECK (`product` | `service`)
- `name` NOT NULL, `description` TEXT NULL
- `sku` TEXT NULL — único por conta quando preenchido (`UNIQUE (account_id, sku) WHERE sku IS NOT NULL`)
- `unit_price` NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (>= 0)
- `stock_qty` NUMERIC(12,3) NOT NULL DEFAULT 0 — **só relevante se `kind = product`**; serviços ficam em 0 e a API rejeita movimento
- `active` BOOLEAN NOT NULL DEFAULT true
- `created_at`, `updated_at`
- Constraint: se `kind = service` então `stock_qty = 0` (CHECK)

**`stock_movements`**

- `id`, `account_id`, `catalog_item_id` (FK, produto)
- `qty` NUMERIC(12,3) NOT NULL — positivo = entrada; negativo = saída
- `reason` CHECK (`sale` | `adjustment_in` | `adjustment_out` | `correction` | `initial`)
- `note` TEXT NULL
- `sale_id` UUID NULL (FK `sales`, preenchido quando `reason = sale`)
- `created_by` UUID (profile/user)
- `created_at`
- Trigger ou lógica de API: após insert, atualiza `catalog_items.stock_qty += qty` e falha se saldo final < 0

**`sales`**

- `id`, `account_id`
- `contact_id` NULL (FK contacts, ON DELETE SET NULL)
- `payment_method` CHECK (`cash` | `pix` | `card` | `other`)
- `total` NUMERIC(12,2) NOT NULL
- `sold_by` UUID NOT NULL
- `created_at`

**`sale_items`**

- `id`, `sale_id`, `catalog_item_id` (FK; item pode ficar inativo depois)
- Snapshots: `kind`, `name`, `unit_price`, `qty`, `line_total`
- `qty` > 0; `line_total = unit_price * qty` (validado na API)

### Regras de negócio

1. Serviço **nunca** gera `stock_movements`.
2. Confirmar venda: inserir `sales` + `sale_items`; para cada item `product`, movimento `sale` com `qty = -quantidade`; total da venda = soma das linhas.
3. Preço no carrinho pode diferir do catálogo (desconto pontual); o snapshot grava o preço usado.
4. Saldo insuficiente → rejeitar a venda inteira (transação atômica), HTTP 409.
5. Soft-delete: `active = false` se o item já apareceu em alguma venda; hard delete só se nunca vendido e sem movimentos (exceto opcionalmente `initial` zerado — na prática: hard delete se não há `sale_items` nem movimentos além de limpeza admin).
6. Ajuste manual (`admin+`): cria movimento `adjustment_in` / `adjustment_out` / `correction` com `note` recomendada; mesma regra de não-negativo após ajuste (exceto se definirmos `correction` podendo forçar — **nesta fatia: nenhum movimento deixa saldo < 0**).
7. Estoque inicial: ao criar produto com `stock_qty` > 0, gravar movimento `initial` com essa quantidade (saldo começa coerente com o ledger).

### UI

- **Catálogo** (`/catalog`): tabs ou filtro `Todos | Produtos | Serviços`; busca por nome/SKU; badge de estoque baixo opcional depois (não obrigatório na fatia 1). Formulário: tipo, nome, SKU, preço, ativo; se produto, quantidade inicial na criação e bloco de estoque na edição.
- **PDV** (`/pos`): busca itens ativos; carrinho; contato opcional (picker de contatos); forma de pagamento; confirmar. Bloqueio client-side se qty > saldo (reforço server-side).
- **Histórico de vendas**: lista em `/pos` (aba) ou `/sales` — data, total, forma, contato, vendedor; detalhe readonly. **Sem cancelamento/estorno nesta fatia.**
- **Mobile:** seguir `ui-responsiva.mdc` (lista + sheet/dialog de formulário; PDV usável em 320–480px).

### Permissões

| Ação | Role mín. |
|------|-----------|
| Listar catálogo / ver movimentos / listar vendas / detalhe | `viewer` |
| Criar venda (PDV) | `agent` |
| CRUD catálogo | `admin` |
| Ajuste de estoque | `admin` |

`viewer` **não** acessa POST de venda nem mutações de catálogo/estoque. Alinha com `requireRole` em `@/lib/auth/account`.

### APIs

| Método | Rota | Role |
|--------|------|------|
| GET, POST | `/api/catalog` | viewer (GET), admin (POST) |
| GET, PATCH, DELETE | `/api/catalog/[id]` | viewer (GET), admin (PATCH/DELETE) |
| GET, POST | `/api/catalog/[id]/stock` | viewer (GET), admin (POST ajuste) |
| GET, POST | `/api/sales` | viewer (GET), agent (POST) |
| GET | `/api/sales/[id]` | viewer |

Validação: type guards manuais (sem Zod). Multi-tenant: sempre filtrar `account_id`.

### Erros

| Caso | Status |
|------|--------|
| Saldo insuficiente | 409 |
| Movimento de estoque em serviço | 400 |
| SKU duplicado na conta | 409 |
| Item inativo no carrinho | 400 |
| Viewer tentando vender | 403 |

### Testes

- Unit (`src/lib/catalog` / `sales`): venda mista produto+serviço baixa só produto; ajuste não deixa saldo negativo; serviço rejeita stock.
- API (Vitest onde o projeto já testa rotas, ou testes de lib se rotas forem só thin wrappers).

### Fora de escopo (Fatia 1 — feito nas fatias seguintes)

- `deal_items` / recalcular `deals.value` / baixa ao `status = won` → Fatia 3+
- Estorno/cancelamento de venda com reversão de estoque → **Fatia 2** (`2026-07-29-sale-refund-design.md`)
- Gateway de pagamento, NF-e, múltiplos depósitos, variantes de SKU
- Relatórios financeiros avançados

## Sucesso

1. Escola cadastra serviços e (se quiser) produtos com preço em BRL.
2. PDV conclui venda com ou sem contato, registra forma de pagamento e baixa estoque dos produtos.
3. Admin ajusta estoque com histórico auditável.
4. Funil de negócios permanece inalterado nesta fatia.
