# Design: Instrutores (opção 3 — role dedicada + disponibilidade)

**Data:** 2026-07-29  
**Status:** implementado  
**Abordagem:** A — sprints sequenciais por camada de risco  
**Plano:** `docs/superpowers/plans/2026-07-29-instructors.md`

## Decisões do produto

| Tema | Decisão |
|------|---------|
| Escopo | Cadastro + locais N:N + padrão semanal + exceções mensais + login 1:1 |
| Role | Nova `instructor` no enum (não reusar agent/viewer) |
| Poder do role | **Só domínio instrutor** — sem inbox/PDV/catálogo/operações |
| E-mail | Só `profiles.email` (sem coluna email em `instructors`) |
| CHA categorias | `mta`, `ara`, `mtr`, `cpa`, `mta_ara`, `mta_mtr`, `mta_cpa` |
| CHA vencida | **Permitir + badge** (não bloqueia save) |
| Vínculo user | **Convite OU** vincular membro existente com role `instructor` (link **manual** pós-aceite) |
| Naming DB | Inglês (`instructors`, …); UI pt-BR |
| Permissões admin | Admin+ CRUD de fichas; Agent+ **não** gerencia frota de instrutores nesta fatia |
| Push | Fora — só badges na listagem |
| Agenda/aulas | Endpoint `available` pronto; bloqueio em “agendar aula” fica quando existir módulo de aulas |

## Auth (crítico)

`instructor` tem **rank 0** (abaixo de `viewer`):

- `is_account_member(account_id)` / `…('viewer')` → **false** (não lê CRM operacional)
- Policies dedicadas em `instructors*` + `accounts_select` com min `instructor` (migration `052`)
- Sidebar mínima + redirect no `DashboardShell` para URLs operacionais
- Hierarquia: `owner(4) > admin(3) > agent(2) > viewer(1) > instructor(0)`

## Arquitetura

```text
profiles.user_id ──1:1──► instructors.user_id (nullable até vínculo)
account
  └─ instructors
        ├─ instructor_locations (N:N → class_locations)
        ├─ instructor_weekly_availability (weekday 0–6)
        └─ instructor_unavailability (on_date)
```

Disponibilidade:

```
active ∧ weekday ∈ weekly ∧ data ∉ unavailability
(+ cha_alert no endpoint available; badge na UI)
```

## Mapa de implementação

| Camada | Onde |
|--------|------|
| Migrations | `049` enum · `050` ranks · `051` tabelas/RLS · `052` accounts_select |
| Roles | `src/lib/auth/roles.ts`, `instructor-routes.ts`, convites Settings |
| Libs | `src/lib/instructors/*` (validate, availability, alerts, link-user) |
| API admin | `/api/instructors`, `[id]`, locations, weekly, unavailability, link-user, invite, available |
| API self | `/api/instructors/me`, `me/weekly`, `me/unavailability` |
| UI admin | `/instructors` + `InstructorForm` + `ChaBadge` |
| UI self | `/my-availability` |
| Docs | `docs/roles-e-permissoes.md` |

## Fora de escopo (permanece)

- Módulo de aulas/agenda consumindo `available`
- Push/notificações
- Histórico versionado do padrão semanal
- Alunos/Cursos
- Auto-link no `redeem_invitation`

## Success criteria

1. Role `instructor` rank 0; convite funciona  
2. Admin CRUD + locais + weekly + exceções (API; self UI para weekly/exceções)  
3. Endpoint `available` correto  
4. Instructor self-service de indisponibilidade  
5. CHA vencida: salva + badge  
6. typecheck / vitest auth+instructors verdes  

**Smoke manual sugerido:** criar com CHA vencida; 2 locais + dias; exceção vs `available`; login instructor (nav mínima).
