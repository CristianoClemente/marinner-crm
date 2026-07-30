# Instrutores — Plano de implementação (sprints)

> **Para o agente:** executar **um sprint por vez**. Ao concluir cada task, marcar `- [x]`. Só iniciar o próximo sprint se o **Check de conclusão** do atual estiver 100% verde.  
> **REQUIRED:** testes da etapa + `npm run typecheck` + lint dos arquivos tocados antes de avançar.

**Goal:** Módulo Instrutores com role dedicada (rank 0), ficha + locais + disponibilidade + vínculo de login.

**Spec:** `docs/superpowers/specs/2026-07-29-instructors-design.md`

**Tech:** Next.js 16, Supabase enum/RLS, Vitest, next-intl pt-BR.

## Global Constraints

- Tabelas em inglês; UI pt-BR
- Sem Zod; type guards manuais
- Auth via `requireRole` / `getCurrentAccount`
- Zero `console.log`; `console.error` só em API com prefixo
- Não inventar role sem atualizar `is_account_member` + `roles.ts` juntos
- Instructor rank **0** (não passa filtro viewer+)

---

## Sprint 0 — Aprovação

- [x] Spec revisado pelo usuário
- [x] Este plano revisado pelo usuário
- [x] Confirmado: vínculo user = convite **ou** link manual (B primeiro)
- [x] Confirmado: rank 0 + nav mínima para instructor

**Check Sprint 0:** aprovação explícita (“pode começar pelo Sprint 1”).

---

## Sprint 1 — Role `instructor`

### Tasks

- [x] 1.1 Escrever testes que falham: `roleRank('instructor') === 0`, `!canSendMessages`, `!canEditSettings`, `isAccountRole`
- [x] 1.2 Migration `049_account_role_instructor.sql` + `050_is_account_member_instructor.sql` + apply remoto
- [x] 1.3 Atualizar `roles.ts` + fazer testes passarem
- [x] 1.4 Convites API/UI + labels + docs roles
- [x] 1.5 Gate de nav para instructor (esconder itens operacionais)

### Check de conclusão Sprint 1

- [x] `npx vitest run src/lib/auth/roles.test.ts` OK
- [x] `npm run typecheck` OK
- [x] lint arquivos tocados OK
- [x] Convite com role `instructor` aceito pela API
- [x] Instructor **não** satisfaz `hasMinRole(..., 'viewer')`

---

## Sprint 2 — Schema + libs

### Tasks

- [x] 2.1 Testes validate / availability / alerts (red)
- [x] 2.2 Migration `051_instructors.sql` + apply
- [x] 2.3 Implementar libs até testes green
- [x] 2.4 Tipos em `@/types`

### Check de conclusão Sprint 2

- [x] Vitest `src/lib/instructors` OK
- [x] Auth roles ainda OK
- [x] typecheck + lint OK
- [x] Tabelas visíveis no remoto (`instructors`, …)

---

## Sprint 3 — API ficha + vínculo

### Tasks

- [x] 3.1 `GET/POST /api/instructors`
- [x] 3.2 `GET/PATCH/DELETE /api/instructors/[id]`
- [x] 3.3 `POST …/link-user` (membro existente role instructor)
- [x] 3.4 `POST …/invite` (cria invitation; link manual pós-aceite documentado na UI)
- [x] 3.5 Testes de validate cobrindo PIX/CHA; smoke mental dos 409

### Check de conclusão Sprint 3

- [x] typecheck + lint OK
- [x] Criar sem user_id OK
- [x] Link user válido OK; duplicado/outra conta 4xx
- [x] Vitest instructors OK

---

## Sprint 4 — Locais + availability API

### Tasks

- [x] 4.1 Endpoints locations / weekly / unavailability
- [x] 4.2 `GET /api/instructors/available`
- [x] 4.3 Endpoints `/api/instructors/me/*` para self-service
- [x] 4.4 Testes availability (casos borda)
- [x] 4.5 Migration `052` — accounts_select permite instructor (getCurrentAccount)

### Check de conclusão Sprint 4

- [x] Vitest availability OK
- [x] typecheck + lint OK
- [x] Available respeita weekly ∩ !exception ∩ active

---

## Sprint 5 — UI

### Tasks

- [x] 5.1 Página `/instructors` (admin)
- [x] 5.2 Form completo (CHA, PIX, locais, weekdays, convite/vínculo)
- [x] 5.3 Página self `/my-availability` (instructor)
- [x] 5.4 i18n + sidebar/header
- [x] 5.5 Badges CHA

### Check de conclusão Sprint 5

- [x] typecheck + lint OK
- [ ] Smoke admin + smoke instructor (checklist manual — não automatizado)

**Smoke manual (pendente validação humana):**

- [ ] Admin cria instrutor com CHA vencida → salva + badge
- [ ] Marca 2 locais + sex/sáb/dom
- [ ] Exceção num sábado remove disponibilidade no `available`
- [ ] Instructor logado só vê nav mínima e registra exceção

---

## Sprint 6 — Hardening

### Tasks

- [x] 6.1 Atualizar `docs/roles-e-permissoes.md`
- [x] 6.2 Spec → status implementado
- [x] 6.3 Regressão ampla: vitest auth+instructors, typecheck, lint
- [x] 6.4 Confirmar instructor bloqueado em rotas agent+ (API rank 0 + redirect shell)

### Check de conclusão Sprint 6

- [x] Todos os checks dos sprints 1–5 permanecem verdes
- [x] Docs atualizados

---

## Ordem de execução (agente)

```text
Sprint 0 (aprovação)
  → Sprint 1 (parar se check falhar)
  → Sprint 2
  → Sprint 3
  → Sprint 4
  → Sprint 5
  → Sprint 6
```

**Proibido:** começar Sprint N+1 com check de N incompleto.  
**Obrigatório:** ao achar erro, corrigir na sprint atual antes de seguir.
