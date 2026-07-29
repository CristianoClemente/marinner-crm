# Design: pt-BR e BRL como padrão do produto

**Data:** 2026-07-29  
**Status:** implementado  
**Abordagem:** A — helpers centralizados + limpeza cirúrgica

## Decisões do produto

| Tema | Decisão |
|------|---------|
| Moeda | Travamento em **BRL** para tudo que for **novo** |
| Histórico | Contas/negócios com outra moeda **preservam** o valor gravado e continuam sendo formatados nessa moeda |
| Idioma da UI | **Só pt-BR** — remover `messages/en.json` e `messages/ko.json` |
| Centavos | **Híbrido** — `R$ 1.234` se inteiro; `R$ 1.234,56` se houver fração |
| Fora de escopo | Idioma de template WhatsApp (`en_US`, etc.) — contrato da Meta, não UI |

## Problema atual

- `DEFAULT_CURRENCY` no front já é `BRL`, mas o DB ainda defaulta `USD` e há fallbacks `'USD'` (ex.: automações).
- Datas/números usam `'pt-BR'` espalhado em dezenas de arquivos (`toLocaleString`, `toLocaleDateString`).
- Labels de moeda estão em inglês; existe seletor multi-moeda em Configurações → Negócios.
- `next-intl` ainda carrega locale via `NEXT_PUBLIC_APP_LOCALE` e mantém dicionários `en`/`ko`.

O front não “entende” o padrão do produto de forma única e explícita.

## Design — Locale e i18n

### Constantes

- `DEFAULT_LOCALE = 'pt-BR'` exportado de `src/lib/format.ts` (única fonte).
- `i18n/request.ts` sempre retorna `pt-BR` e importa só `messages/pt-BR.json`.
- Remover dependência de `NEXT_PUBLIC_APP_LOCALE` (e de exemplos de env, se houver).
- `currency.ts` importa `DEFAULT_LOCALE` de `format.ts` em vez de duplicar a string.

### Mensagens

- Manter apenas `messages/pt-BR.json`.
- Apagar `messages/en.json` e `messages/ko.json`.
- Ajustar qualquer import/teste que referencie esses arquivos.

### Formatadores

Novo módulo `src/lib/format.ts` (fonte da verdade para exibição):

| Função | Papel |
|--------|--------|
| `formatDate(iso \| Date, options?)` | Data curta pt-BR |
| `formatDateTime(iso \| Date, options?)` | Data + hora pt-BR |
| `formatNumber(value, options?)` | Número agrupado pt-BR |

Regras:

- Zero `toLocaleString('pt-BR')` / `toLocaleDateString('pt-BR')` soltos no front — passar pelos helpers.
- Onde `date-fns` precisar de locale, usar sempre `ptBR`.
- Testes unitários cobrindo casos básicos (data, número com milhar).

### Explicitamente fora

- Campos `template_language` / códigos Meta (`en_US`, `pt_BR` de template) **não** mudam.

## Design — Moeda BRL

### Constantes e formatadores (`src/lib/currency.ts`)

- `DEFAULT_CURRENCY = 'BRL'` permanece.
- `FORMAT_LOCALE` alinhado a `DEFAULT_LOCALE` (import do módulo de format ou constante compartilhada).
- `formatCurrency(value, currency = DEFAULT_CURRENCY)`:
  - locale `pt-BR`;
  - `minimumFractionDigits: 0`, `maximumFractionDigits: 2` (híbrido);
  - se `currency` legado inválido, fallback seguro (já existente).
- `formatCurrencyShort`: mesma regra de default; símbolo/label de BRL em pt-BR (`Real`, `R$`).
- `CURRENCIES`: lista com **apenas** `{ code: "BRL", label: "Real", symbol: "R$" }` — serve para label/símbolo; nenhum picker multi-moeda permanece.

### UI

- **Configurações → Negócios:** remove o seletor e a lógica de save de moeda. O painel fica **informativo** (“Valores em Real (BRL)”) — a seção permanece no rail porque ainda comunica o padrão do workspace.
- **Formulário / criação de negócio:** sempre grava `currency: BRL`; sem dropdown de moeda.
- **Overview / hints da rail:** hint fixo `BRL` (ou “Real”), sem ler `defaultCurrency` como se fosse escolha do usuário.
- **Exibição de deal legado:** `formatCurrency(deal.value, deal.currency || DEFAULT_CURRENCY)` — USD antigo continua em dólar.

### Backend / auth / engines

- Substituir fallbacks literais `'USD'` por `DEFAULT_CURRENCY` (ex.: `src/lib/automations/engine.ts`, `use-auth`).
- Novas escritas de `accounts.default_currency` e `deals.currency` usam `BRL`.

### Migration (Supabase)

Nova migration (ex.: `0xx_default_currency_brl.sql`):

```sql
-- Só muda o DEFAULT de colunas. NÃO reescreve linhas existentes.
ALTER TABLE accounts ALTER COLUMN default_currency SET DEFAULT 'BRL';
ALTER TABLE deals ALTER COLUMN currency SET DEFAULT 'BRL';
```

(Confirmar nomes exatos das colunas nas migrations existentes antes de aplicar.)

## Critérios de sucesso

1. Novo negócio e nova conta → sempre BRL.
2. Deal antigo com USD (ou outra) → continua exibindo essa moeda.
3. Zero seletor de moeda na UI.
4. Zero dicionário `en`/`ko` no repo.
5. Datas e números do front só via helpers de `format` / `currency`.
6. `npm run typecheck`, `npm run lint` e testes de `currency`/`format` passam.

## Fora de escopo desta entrega

- Conversão cambial de valores históricos.
- Remover colunas `currency` / `default_currency` do schema.
- Traduzir conteúdo gerado por IA ou templates Meta.
- Alterar idioma de templates WhatsApp.

## Riscos e mitigações

| Risco | Mitigação |
|-------|-----------|
| Quebrar imports de `en`/`ko` | Grep + typecheck antes de concluir |
| Compact (`1.2k`) ainda “inglês” | Aceitável nesta entrega; opcional alinhar depois (`mil`/`mi`) se desejado |
| Contas antigas com `default_currency` USD | Preservar; só default de coluna e novas escritas mudam |

## Plano de implementação (alto nível)

1. Criar `src/lib/format.ts` + testes; exportar `DEFAULT_LOCALE`.
2. Endurecer `currency.ts` (híbrido, só BRL na lista, docs/comentários).
3. Migration DEFAULT BRL.
4. Remover seletor/seção de moeda; forçar BRL na criação de deals.
5. Corrigir fallbacks USD no backend/auth.
6. Substituir formatadores espalhados pelos helpers.
7. Remover `en.json`/`ko.json` e simplificar `i18n/request.ts`.
8. Atualizar `AGENTS.md` / regra Cursor: padrão do produto = pt-BR + BRL.
9. Typecheck, lint, testes.
