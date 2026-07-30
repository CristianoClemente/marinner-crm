# Design: Importação CSV do catálogo

**Data:** 2026-07-29  
**Status:** aprovado (abordagem A)  
**Decisões:** upsert por SKU; modal no cliente reutilizando POST/PATCH existentes

## Objetivo

Importar produtos e serviços via CSV no módulo Catálogo, no mesmo padrão de Contatos (modelo para download, preview, resultado).

## Colunas

| Coluna | Obrigatório | Notas |
|--------|-------------|--------|
| `kind` | sim | `product` ou `service` |
| `name` | sim | |
| `unit_price` | sim | número ≥ 0 |
| `sku` | não | chave do upsert (normalizado UPPER) |
| `description` | não | |
| `initial_stock` | não | só produto **na criação**; inteiro ≥ 0; ignorado no update |
| `active` | não | true/false (default true) |

## Upsert

1. Sem SKU ou SKU inexistente → `POST /api/catalog` (cria; estoque inicial vira movimento `initial`).
2. SKU já existe na conta → `PATCH /api/catalog/:id` (atualiza name, description, unit_price, active). Não altera estoque nem `kind` no update.

Linhas inválidas são puladas e contadas em `failed`/`skipped`.

## Peças

- `src/lib/catalog/parse-catalog-csv.ts` (+ testes)
- `src/components/catalog/import-modal.tsx`
- Botão Importar no header de `/catalog`
- i18n `Catalog.importModal`
