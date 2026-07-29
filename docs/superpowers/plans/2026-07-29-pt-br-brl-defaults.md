# pt-BR + BRL Defaults Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o front e os defaults do banco tratarem pt-BR e BRL como o único padrão do produto, com helpers centralizados e sem seletor multi-moeda / dicionários en-ko.

**Architecture:** `src/lib/format.ts` é a fonte de `DEFAULT_LOCALE` e formatadores de data/número. `src/lib/currency.ts` importa o locale, formata BRL (híbrido de centavos), lista só BRL, e ainda formata moedas legadas. UI de Configurações → Negócios fica informativa. Migration 041 só altera DEFAULT das colunas.

**Tech Stack:** Next.js 16, TypeScript, next-intl, Vitest, Supabase migrations, Intl API.

## Global Constraints

- Idioma UI: só `pt-BR` (apagar `messages/en.json` e `messages/ko.json`)
- Moeda nova: sempre `BRL`; histórico preserva coluna gravada
- Centavos: híbrido (`minimumFractionDigits: 0`, `maximumFractionDigits: 2`)
- Templates WhatsApp `en_US` / `pt_BR` de API: não alterar
- Comentários e commits em pt-BR

## File map

| Arquivo | Responsabilidade |
|---------|------------------|
| `src/lib/format.ts` | `DEFAULT_LOCALE`, `formatDate`, `formatDateTime`, `formatNumber` |
| `src/lib/format.test.ts` | Testes dos helpers |
| `src/lib/currency.ts` | BRL only + formatadores |
| `src/lib/currency.test.ts` | Ajustar expectativas |
| `supabase/migrations/041_default_currency_brl.sql` | DEFAULT BRL |
| `src/i18n/request.ts` | Locale fixo pt-BR |
| `src/components/settings/deals-settings.tsx` | Painel informativo |
| `messages/pt-BR.json` | Copy do painel Negócios |
| Vários componentes | Trocar `toLocale*` por helpers |
| Remover | `messages/en.json`, `messages/ko.json` |

---

### Task 1: Helpers `format.ts` + testes

**Files:**
- Create: `src/lib/format.ts`
- Create: `src/lib/format.test.ts`

**Produces:** `DEFAULT_LOCALE`, `formatDate`, `formatDateTime`, `formatNumber`

- [ ] **Step 1: Escrever testes que falham**

```ts
import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOCALE,
  formatDate,
  formatDateTime,
  formatNumber,
} from "./format";

describe("format", () => {
  it("exporta pt-BR como locale padrão", () => {
    expect(DEFAULT_LOCALE).toBe("pt-BR");
  });

  it("formatNumber agrupa milhares no padrão BR", () => {
    expect(formatNumber(1234)).toBe("1.234");
  });

  it("formatDate formata ISO em data curta pt-BR", () => {
    // 2024-01-15T12:00:00.000Z — dia estável em qualquer TZ com date-only
    expect(formatDate("2024-01-15")).toMatch(/15/);
  });

  it("formatDateTime inclui hora", () => {
    const out = formatDateTime("2024-01-15T15:30:00.000Z");
    expect(out.length).toBeGreaterThan(8);
  });
});
```

- [ ] **Step 2: Rodar e ver falha**

Run: `npx vitest run src/lib/format.test.ts`
Expected: FAIL (módulo inexistente)

- [ ] **Step 3: Implementar**

```ts
export const DEFAULT_LOCALE = "pt-BR";

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

export function formatDate(
  value: string | Date,
  options?: Intl.DateTimeFormatOptions,
): string {
  return toDate(value).toLocaleDateString(DEFAULT_LOCALE, options);
}

export function formatDateTime(
  value: string | Date,
  options?: Intl.DateTimeFormatOptions,
): string {
  return toDate(value).toLocaleString(DEFAULT_LOCALE, options);
}

export function formatNumber(
  value: number,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(DEFAULT_LOCALE, options).format(
    Number(value) || 0,
  );
}
```

- [ ] **Step 4: Rodar testes — PASS**

Run: `npx vitest run src/lib/format.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/format.ts src/lib/format.test.ts
git commit -m "feat: helpers de formatacao pt-BR"
```

---

### Task 2: Endurecer `currency.ts` (só BRL + híbrido)

**Files:**
- Modify: `src/lib/currency.ts`
- Modify: `src/lib/currency.test.ts`

**Consumes:** `DEFAULT_LOCALE` de `@/lib/format`

- [ ] **Step 1: Atualizar testes** para BRL default, híbrido (1234 → sem `,00`; 1234.5 → com fração), `CURRENCIES` só BRL, short com `R$`

- [ ] **Step 2: Rodar — falha nas expectativas antigas USD**

- [ ] **Step 3: Reescrever `currency.ts`**
  - Importar `DEFAULT_LOCALE`
  - `CURRENCIES = [{ code: "BRL", label: "Real", symbol: "R$" }]`
  - `formatCurrency`: `minimumFractionDigits: 0`, `maximumFractionDigits: 2`
  - `currencySymbol(code)`: lookup em CURRENCIES; senão `Intl` `formatToParts` (legado); senão `` `${code} ` ``
  - Comentários em pt-BR alinhados ao spec

- [ ] **Step 4: Testes PASS**

- [ ] **Step 5: Commit** `fix(currency): BRL unico e centavos hibridos`

---

### Task 3: Migration DEFAULT BRL

**Files:**
- Create: `supabase/migrations/041_default_currency_brl.sql`

```sql
-- 041_default_currency_brl
-- Só altera o DEFAULT. Linhas existentes (USD etc.) permanecem intactas.

ALTER TABLE accounts
  ALTER COLUMN default_currency SET DEFAULT 'BRL';

ALTER TABLE deals
  ALTER COLUMN currency SET DEFAULT 'BRL';
```

- [ ] **Step 1: Criar arquivo**
- [ ] **Step 2: Commit** `chore(db): default BRL em accounts e deals`

---

### Task 4: UI Negócios informativa + fallbacks USD + overview

**Files:**
- Modify: `src/components/settings/deals-settings.tsx` — remover select/save; texto fixo Real (BRL)
- Modify: `messages/pt-BR.json` — chaves `Settings.deals` para copy informativa
- Modify: `src/lib/automations/engine.ts` — `'USD'` → `DEFAULT_CURRENCY`
- Modify: `src/hooks/use-auth.tsx` — comentários USD → BRL
- Modify: `src/app/(dashboard)/settings/page.tsx` — hint `deals: 'BRL'`
- Modify: `src/components/settings/settings-overview.tsx` — subtítulo fixo Real/BRL

- [ ] **Step 1–4: Implementar e typecheck parcial**
- [ ] **Step 5: Commit** `feat(settings): moeda BRL informativa sem seletor`

---

### Task 5: Substituir `toLocale*` pelos helpers

**Files:** todos os arquivos listados no grep de `toLocaleString('pt-BR')` / `toLocaleDateString('pt-BR')` em `src/` (dashboard, broadcasts, contacts, settings, inbox, pipelines, join, etc.)

- [ ] Trocar datas → `formatDate` / `formatDateTime`
- [ ] Trocar números → `formatNumber`
- [ ] `contact-sidebar` deal value: preferir `formatCurrency` se for valor monetário
- [ ] Commit: `refactor: centraliza formatacao de datas e numeros`

---

### Task 6: Remover en/ko e fixar i18n

**Files:**
- Delete: `messages/en.json`, `messages/ko.json`
- Modify: `src/i18n/request.ts` — sempre pt-BR, sem env
- Modify: `.env.local.example` — remover ou comentar `NEXT_PUBLIC_APP_LOCALE`
- Grep: garantir zero imports dos dicionários removidos

- [ ] Commit: `chore(i18n): remove en/ko e fixa locale pt-BR`

---

### Task 7: Docs + verificação final

**Files:**
- Modify: `AGENTS.md` e `.cursor/rules/geral.mdc` — padrão pt-BR + BRL
- Run: `npx tsc --noEmit`, `npx vitest run src/lib/format.test.ts src/lib/currency.test.ts`, `npx eslint` nos paths tocados

- [ ] Commit: `docs: padrao do produto pt-BR e BRL`
- [ ] Push se o usuário pedir

---

## Spec coverage

| Requisito | Task |
|-----------|------|
| `DEFAULT_LOCALE` + helpers | 1 |
| currency BRL + híbrido + lista só BRL | 2 |
| Migration DEFAULT | 3 |
| UI sem seletor + fallbacks | 4 |
| Zero toLocale solto | 5 |
| Remover en/ko | 6 |
| AGENTS / regras | 7 |
| Histórico preservado | 2+3 (sem UPDATE) |
| WhatsApp template lang intacto | (não tocado) |
