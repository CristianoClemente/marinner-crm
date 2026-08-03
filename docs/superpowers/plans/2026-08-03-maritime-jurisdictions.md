# Jurisdições marítimas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven-development) task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Catálogo OM/STA + vínculos por escola (responsável, e-mail override, limite de plano) + jurisdição em locais de aula + responsável automático nos atestados.

**Architecture:** `maritime_authorities` (seed global) + `account_jurisdictions` (tenant) + `class_locations.authority_id`. Atestado: local → authority → vínculo → profile. UI: aba Jurisdições em Configurações + Dialog; form de locais.

**Tech Stack:** Next.js 16, Supabase SQL/RLS, Vitest, next-intl pt-BR, shadcn Dialog.

**Spec:** `docs/superpowers/specs/2026-08-03-maritime-jurisdictions-design.md`

## Global Constraints

- pt-BR only (`messages/pt-BR.json`)
- Sem Zod; type guards manuais
- Auth API: `requireRole` / `getCurrentAccount` + `toErrorResponse`
- Multi-tenant: `account_id` + RLS
- Zero `console.log`; `console.error` só em `src/lib/**` / `src/app/api/**` com prefixo
- `npm run typecheck` + lint do escopo + vitest dos módulos tocados

## File map

| Path | Role |
|------|------|
| `supabase/migrations/065_maritime_jurisdictions.sql` | Tabelas, seed, `authority_id`, features dos planos, RLS |
| `src/lib/billing/entitlements.ts` (+ test) | `maxJurisdictions` |
| `src/lib/maritime/types.ts` | Tipos Authority / AccountJurisdiction |
| `src/lib/maritime/validate.ts` (+ test) | Validação create/patch vínculo; email efetivo |
| `src/lib/maritime/resolve-responsible.ts` (+ test) | Resolve responsável para documento via location |
| `src/app/api/maritime-authorities/route.ts` | GET catálogo |
| `src/app/api/account/jurisdictions/route.ts` | GET/POST |
| `src/app/api/account/jurisdictions/[id]/route.ts` | PATCH/DELETE |
| `src/lib/class-locations/validate.ts` (+ test) | `authority_id` obrigatório create/update |
| `src/app/api/class-locations/**` | Persistir/validar vínculo |
| `src/components/settings/jurisdictions-panel.tsx` | Lista + Dialog |
| `src/components/settings/appearance-panel.tsx` | Monta painel após BrandingPanel |
| `src/components/class-locations/location-form.tsx` | Select jurisdição |
| `src/lib/documents/types.ts` + templates + `generate.ts` | `responsibleName` no atestado |
| `messages/pt-BR.json` | `Settings.jurisdictions` + gaps de local/doc |

---

### Task 1: Migration + seed

**Files:**
- Create: `supabase/migrations/065_maritime_jurisdictions.sql`
- Source seed (canônico): `docs/om_sta_rows.csv` — mapear `criado_em`/`atualizado_em` → `created_at`/`updated_at`; tabela destino `maritime_authorities`
- Legado: `docs/om_sta_rows.sql` (não usar para updates)

- [ ] **Step 1:** CREATE `maritime_authorities` (id INTEGER PK, sigla UNIQUE, nome, endereço, telefone, email, timestamps) + RLS SELECT authenticated
- [ ] **Step 2:** INSERT 69 rows do seed
- [ ] **Step 3:** CREATE `account_jurisdictions` + UNIQUE(account_id, authority_id) + unique partial index `is_default` + RLS member CRUD (write admin via app; RLS select member / write policies alinhadas a outras settings — preferir SELECT member, INSERT/UPDATE/DELETE via policies `is_account_member(..., 'admin')` se o projeto já usa rank; senão SELECT broad + writes só service/API com RLS member update pattern de members)
- [ ] **Step 4:** `ALTER class_locations ADD authority_id INT NULL REFERENCES maritime_authorities(id)`
- [ ] **Step 5:** UPDATE plans features `max_jurisdictions` 1/3/null
- [ ] **Step 6:** Aplicar no remoto via MCP `apply_migration` (projeto `ypyafrwguvtsmgfwsjcj`)
- [ ] **Step 7:** Commit `feat(db): jurisdições marítimas e vínculos por conta`

**RLS pattern:** espelhar `class_locations` / tags — `is_account_member(account_id, 'viewer')` SELECT; insert/update/delete com `'admin'` se existir helper; senão viewer+ e API `requireRole('admin')`.

### Task 2: Entitlements `maxJurisdictions`

**Files:**
- Modify: `src/lib/billing/entitlements.ts`
- Modify: `src/lib/billing/entitlements.test.ts`

**Produces:**
- `maxJurisdictions: number | null` em `Entitlements`
- Helper `parseMaxJurisdictions(features): number | null` — number ≥ 1 ou null (ilimitado); ausente → tratar como `1` (seguro) ou `null` só business; **spec:** ler de features; se key ausente, `1` para não abrir ilimitado por acidente

- [ ] **Step 1:** Teste: starter features `{ max_jurisdictions: 1 }` → 1; `{ max_jurisdictions: null }` → null; sem key → 1
- [ ] **Step 2:** Implementar em `computeEntitlements`
- [ ] **Step 3:** `npx vitest run src/lib/billing/entitlements.test.ts` → PASS
- [ ] **Step 4:** Commit `feat(billing): limite max_jurisdictions nos entitlements`

### Task 3: Lib maritime (validate + resolve)

**Files:**
- Create: `src/lib/maritime/types.ts`
- Create: `src/lib/maritime/validate.ts`
- Create: `src/lib/maritime/validate.test.ts`
- Create: `src/lib/maritime/resolve-responsible.ts`
- Create: `src/lib/maritime/resolve-responsible.test.ts`

**Produces:**
- `effectiveJurisdictionEmail(override, catalogEmail): string | null`
- `validateJurisdictionCreate(body)` → `{ authority_id, responsible_user_id, email_override, is_default }`
- `validateJurisdictionPatch(body)`
- `canAddJurisdiction(currentCount, maxJurisdictions): boolean`
- `resolveResponsibleForLocation({ authorityId, jurisdictions })` → responsible profile fields ou erro tipado

- [ ] **Step 1:** Testes validate + email efetivo + canAdd (null max = sempre true; count >= max = false)
- [ ] **Step 2:** Implementar
- [ ] **Step 3:** Teste resolve: encontra vínculo pela authority; missing → gap
- [ ] **Step 4:** vitest → PASS; commit `feat: validação e resolve de jurisdições`

### Task 4: APIs catálogo + vínculos

**Files:**
- Create: `src/app/api/maritime-authorities/route.ts`
- Create: `src/app/api/account/jurisdictions/route.ts`
- Create: `src/app/api/account/jurisdictions/[id]/route.ts`

- [ ] **Step 1:** GET authorities — `getCurrentAccount`; filtro `q` (sigla/nome/cidade ilike), `uf`
- [ ] **Step 2:** GET jurisdictions — join authority + responsible (profiles id, full_name ou name field existente)
- [ ] **Step 3:** POST — `requireRole('admin')`; entitlements limit; membership check; se `is_default`, clear others
- [ ] **Step 4:** PATCH/DELETE — DELETE 409 se `class_locations` da conta com `authority_id`
- [ ] **Step 5:** Commit `feat(api): catálogo OM e vínculos de jurisdição`

### Task 5: Locais — validate + API + form

**Files:**
- Modify: `src/lib/class-locations/validate.ts` (+ test)
- Modify: `src/app/api/class-locations/route.ts`, `[id]/route.ts`
- Modify: `src/components/class-locations/location-form.tsx`
- Modify: page se necessário para carregar jurisdictions

- [ ] **Step 1:** `authority_id: number` obrigatório no create; no patch se presente deve ser number; erro `missing_authority` / `invalid_authority`
- [ ] **Step 2:** API POST/PATCH: verificar row em `account_jurisdictions` antes do insert/update
- [ ] **Step 3:** Form: select das vinculadas; empty → link Configurações `?tab=appearance`; default pré-selecionado
- [ ] **Step 4:** vitest validate; commit `feat: jurisdição obrigatória em locais de aula`

### Task 6: Settings UI Jurisdições

**Files:**
- Create: `src/components/settings/jurisdictions-panel.tsx`
- Modify: `src/components/settings/appearance-panel.tsx` — `<JurisdictionsPanel />` após `<BrandingPanel />`
- Modify: `messages/pt-BR.json` — `Settings.jurisdictions.*`

Copy keys mínimas: `title`, `description`, `count` (`{used} de {max}` / ilimitado), `add`, `edit`, `empty`, `emptyHint`, `limitReached`, `upgradeHint`, `responsible`, `email`, `emailOverrideHint`, `default`, `setDefault`, `searchAuthority`, `save`, `remove`, `removeBlocked`, `loadError`

- [ ] **Step 1:** i18n
- [ ] **Step 2:** Panel lista + Dialog (busca OM, membro, email, default) + enforcement UI do limite
- [ ] **Step 3:** typecheck; commit `feat(settings): painel de jurisdições no bloco Escola`

### Task 7: Atestados — responsável no PDF

**Files:**
- Modify: `src/lib/documents/types.ts` — `SchoolDocumentFields` + `responsibleName`
- Modify: `src/lib/documents/generate.ts` — resolve via location.authority_id + jurisdictions
- Modify: `src/lib/documents/templates/atestado-arrais.ts`, `atestado-motonauta.ts`
- Modify: `src/lib/documents/render-html.test.ts` (+ gaps validation se houver)

- [ ] **Step 1:** Estender tipo + template HTML com linha Responsável / estabelecimento
- [ ] **Step 2:** Em generate atestado: carregar location.authority_id; buscar vínculo; gap se null
- [ ] **Step 3:** Snapshot no payload; vitest HTML
- [ ] **Step 4:** Commit `feat(docs): responsável da jurisdição nos atestados`

### Task 8: Verify + spec status

- [ ] `npm run typecheck` + `npm run lint` + vitest módulos maritime/billing/class-locations/documents
- [ ] Spec status → `implementado (v1)`
- [ ] Commit docs se pendente

---

## Spec coverage (self-review)

| Spec | Task |
|------|------|
| Catálogo + seed | 1 |
| account_jurisdictions + default + email | 1, 3, 4, 6 |
| max_jurisdictions planos | 1, 2, 4, 6 |
| class_locations.authority_id | 1, 5 |
| APIs | 4 |
| Settings Escola + Dialog | 6 |
| Atestado via local | 7 |
| Bloquear delete com local | 4 |
| Fora: automação / funil | — (não fazer) |

**Execution:** inline nesta sessão (usuário: “pode iniciar”).
