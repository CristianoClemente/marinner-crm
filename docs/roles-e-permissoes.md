# Roles e permissões — Marinner CRM

Documento de referência do modelo de acesso da conta (multi-usuário).  
Fonte canônica de capabilities no código: `src/lib/auth/roles.ts`.  
Espelho no banco: enum `account_role_enum` + helper `is_account_member()` (migration `017_account_sharing.sql`).

---

## 1. Visão geral

- **Uma conta por usuário** (membership única). Não existe tabela `account_members`.
- O papel do usuário fica em **`profiles.account_role`**.
- A conta fica em **`profiles.account_id`** → `accounts`.
- Tenancy **não** usa mais `user_id` para isolamento; `user_id` nas tabelas de domínio é audit/assignment.
- Hierarquia ordinal (maior = mais privilégio), alinhada entre TypeScript e Postgres:

| Role     | Rank | Resumo                                      |
|----------|------|---------------------------------------------|
| `owner`  | 4    | Dono da conta; único que transfere ownership |
| `admin`  | 3    | Configurações + gestão de membros           |
| `agent`  | 2    | Operação (inbox, contatos, deals, flows…)   |
| `viewer` | 1    | Somente leitura                             |

Não existe role `manager`. “Agent” também aparece como `sender_type` de mensagem (`customer` | `agent` | `bot`) — **não** é o role da conta.

---

## 2. Onde está definido

| Camada | Arquivo | Conteúdo |
|--------|---------|----------|
| Predicados TS | `src/lib/auth/roles.ts` | `AccountRole`, `roleRank`, `hasMinRole`, `can*` |
| Contexto servidor | `src/lib/auth/account.ts` | `getCurrentAccount`, `requireRole`, `toErrorResponse` |
| API keys (scopes) | `src/lib/auth/api-context.ts`, `src/lib/api-keys/scopes.ts` | Auth por chave, **não** por role humano |
| Convites | `src/lib/auth/invitations.ts` | Hash/token de convite |
| Hook cliente | `src/hooks/use-auth.tsx` | `accountRole`, `canManageMembers`, `canEditSettings`, `canSendMessages`… |
| Gate booleano | `src/hooks/use-can.ts` | `useCan("edit-settings" \| …)` |
| Gate de render | `src/components/auth/require-role.tsx` | `<RequireRole min="admin">` |
| Labels UI | `src/components/settings/role-meta.ts` | Ícones/cores por role |
| Tipos | `src/types/index.ts` | `Profile.account_role`, `AccountInvitation` |
| Testes | `src/lib/auth/roles.test.ts` | Hierarquia e predicados |
| Schema/RLS | `supabase/migrations/017_*.sql` | Enum, `is_account_member`, policies base |
| RPCs membros | `supabase/migrations/018_*.sql` | `set_member_role`, `remove_account_member`, `transfer_account_ownership` |
| RPCs convite | `supabase/migrations/019_*.sql` | `peek_invitation`, `redeem_invitation` |
| Anti-escalação | `supabase/migrations/034_*.sql` | Trigger em `profiles` bloqueia self-change de `account_role` / `account_id` |

---

## 3. Schema relevante

### `accounts`
- `id`, `name`, `owner_user_id` (UNIQUE → um owner por conta pessoal original)
- Fonte de verdade de **membership** é `profiles.account_id`, não esta tabela sozinha

### `profiles`
| Coluna | Uso |
|--------|-----|
| `account_id` | Conta atual do usuário |
| `account_role` | `account_role_enum` — role efetivo |
| `role` (TEXT) | **Legado** (`DEFAULT 'user'`). Não usado para auth; candidato a remoção |

### `account_invitations`
- `account_id`, `token_hash`, `role` (CHECK: **não** pode ser `owner`)
- Expiry / metadados de aceite
- Roles convidáveis: `admin` | `agent` | `viewer`

### Signup (`handle_new_user`)
Todo signup cria uma conta pessoal + profile com **`account_role = 'owner'`**.  
Ao aceitar convite, o usuário **sai** dessa conta pessoal (se vazia) e entra na conta convidada com o role do convite.

---

## 4. Capabilities (matriz)

Predicados em `src/lib/auth/roles.ts` — **usar sempre estes**, nunca comparar strings de role soltas.

| Capability | Predicado | owner | admin | agent | viewer |
|------------|-----------|:-----:|:-----:|:-----:|:------:|
| Ler dados da conta | membro (`viewer+`) | ✓ | ✓ | ✓ | ✓ |
| Operação (enviar msg, CRUD contatos/deals/broadcasts/automations/flows) | `canSendMessages` → `agent+` | ✓ | ✓ | ✓ | ✗ |
| Editar settings (WhatsApp, templates, tags, pipelines, AI config, API keys…) | `canEditSettings` → `admin+` | ✓ | ✓ | ✗ | ✗ |
| Gerenciar membros / convites / mudar roles | `canManageMembers` → `admin+` | ✓ | ✓ | ✗ | ✗ |
| Transferir ownership | `canTransferOwnership` | ✓ | ✗ | ✗ | ✗ |
| Deletar conta | `canDeleteAccount` | ✓ | ✗ | ✗ | ✗ |

`useCan` mapeia:

| Action key | Predicado |
|------------|-----------|
| `manage-members` | `canManageMembers` |
| `edit-settings` | `canEditSettings` |
| `send-messages` | `canSendMessages` |
| `view-only` | `canViewOnly` |
| `delete-account` | `canDeleteAccount` |
| `transfer-ownership` | `canTransferOwnership` |

**Atenção:** em `useAuth`, `isAdmin` é **estrito** (`=== 'admin'`) e **não** inclui `owner`. Para “admin ou acima”, use `canManageMembers` / `canEditSettings` / `hasMinRole(role, 'admin')`.

---

## 5. Enforcement em camadas

```
Browser UI (useCan / RequireRole)
    → API route (requireRole("admin"|"agent"|…))
        → Supabase client com sessão do usuário
            → RLS via is_account_member(account_id, min_role)
```

### 5.1 Servidor — `requireRole(min)`

```ts
const ctx = await requireRole("admin");
// ctx.userId, ctx.accountId, ctx.role, ctx.supabase, ctx.account
```

- Sem sessão → `UnauthorizedError` (401)
- Role abaixo do mínimo → `ForbiddenError` (403)
- Converter com `toErrorResponse(err)`

Exemplos típicos:
- **admin+:** PATCH account, invitations, members, API keys, AI config/knowledge
- **agent+:** automations, flows, quick-replies write, contact tags, AI draft/autoreply
- **owner:** transfer-ownership

### 5.2 Cliente

```tsx
const canEdit = useCan("edit-settings");
<Button disabled={!canEdit} />

<RequireRole min="admin">{/* … */}</RequireRole>
```

Enquanto `profileLoading`, `useCan` e `RequireRole` falham fechados (`false` / não renderizam conteúdo privilegiado).

### 5.3 Middleware (`src/middleware.ts`)

- Valida **apenas autenticação** (cookie), **não** role.
- Paths protegidos (login obrigatório):  
  `/dashboard`, `/inbox`, `/contacts`, `/pipelines`, `/broadcasts`, `/automations`, `/settings`
- **Não** listados hoje: `/flows`, `/agents`, `/notifications` (gap de edge auth).

### 5.4 RLS — `is_account_member(account_id, min_role)`

Função `SECURITY DEFINER` que compara ranks:

```
owner=4 ≥ admin=3 ≥ agent=2 ≥ viewer=1
```

Padrão geral:

| Classe | SELECT | INSERT/UPDATE/DELETE |
|--------|--------|---------------------|
| **Operacional** (contacts, conversations, messages, deals, broadcasts, automations, flows, contact_notes, contact_tags…) | `viewer+` | `agent+` |
| **Settings** (tags, whatsapp_config, message_templates, pipelines, api_keys write, ai_configs, invitations…) | `viewer+` | `admin+` |
| **Logs / runs** | `viewer+` | em geral só `service_role` |
| **profiles** | membros da conta | UPDATE só da própria linha; trigger 034 impede mudança de `account_role`/`account_id` pelo client |

Storage (`flow-media`, `chat-media`): costuma exigir membership da conta, sem distinção fina admin/agent nas policies de upload.

---

## 6. Matriz prática por feature

| Área | Ler | Escrever / executar | Observação |
|------|-----|---------------------|------------|
| Inbox / mensagens | todos | `agent+` | Composer gated com `useCan("send-messages")` |
| Contatos | todos | `agent+` | Import: criar tags novas exige `canEditSettings` |
| Pipelines (estrutura) | todos | `admin+` | |
| Deals | todos | `agent+` | |
| Broadcasts | todos | `agent+` | |
| Automações / Flows | todos | `agent+` | |
| Tags (catálogo) | todos | `admin+` | |
| WhatsApp config / templates | todos | `admin+` | UI de settings ainda fraca em gates |
| Quick replies | todos | `agent+` (RLS) | Vivem em Settings — inconsistência UX |
| Membros / convites | admin+ vê gestão | `admin+` | |
| API keys (mint) | admin+ | `admin+` | Scopes da chave ≠ role do usuário |
| AI config / knowledge | admin+ edita | `admin+` | |
| Transfer ownership | — | `owner` | API/RPC prontos; UI incompleta |
| Delete account | — | `owner` | Predicado existe; sem UI/rota aparente |

---

## 7. Convites e onboarding

1. **Admin+** cria convite: `POST /api/account/invitations` com role ∈ `{admin, agent, viewer}`.
2. Token plaintext exibido **uma vez**; no banco fica `token_hash`.
3. Link `/join/[token]` → `peek_invitation` (anon/authenticated).
4. Se o convidado ainda não tem conta: signup cria conta pessoal owner.
5. `redeem_invitation`:
   - Move `profiles.account_id` + `account_role` para a conta do convite
   - Apaga a conta pessoal **vazia**
   - Recusa (409) se já está em conta compartilhada ou se a conta pessoal tem dados
6. Login/signup com `?invite=` no middleware redireciona para `/join/<token>`.

UI: `InviteMemberDialog` (default `agent`); aba Members lista convites pendentes para admin+.

RPCs: `set_member_role`, `remove_account_member` (admin+; ao remover, recria conta pessoal vazia como owner), `transfer_account_ownership` (owner only).

---

## 8. API keys (escopos ≠ roles)

Autorização da **Public API** (`/api/v1/*`) é por **scopes** da chave, não pelo `account_role` de quem usa a chave.

Scopes (`src/lib/api-keys/scopes.ts`):

- `messages:send` / `messages:read`
- `contacts:read` / `contacts:write`
- `conversations:read`
- `broadcasts:send`
- `webhooks:manage`

Criar/revogar chaves exige **admin+** (humano). O que a chave pode fazer depende só da lista de scopes no mint.

---

## 9. Como adicionar uma nova permissão

1. Criar predicado em `src/lib/auth/roles.ts` (ex.: `canManageBilling`).
2. Expor em `useCan` (`CanAction` + switch) se a UI precisar.
3. Guardar rotas com `requireRole("admin"|"agent"|…)`.
4. Ajustar RLS com `is_account_member(account_id, 'admin'|'agent')` na migration.
5. Cobrir com teste em `roles.test.ts`.

Evitar `role === 'admin'` espalhado — quebra owner e diverge do SQL.

---

## 10. Gaps e inconsistências conhecidos

1. **`profiles.role` legado** ainda existe; auth usa só `account_role`.
2. **Middleware** não cobre `/flows`, `/agents`, `/notifications`.
3. **Várias rotas WhatsApp** checam só `getUser()` e delegam ao RLS — viewer autenticado pode bater na API e falhar só no Postgres (sem 403 tipado cedo).
4. **Settings UI** nem sempre esconde seções admin-only (rail/comentários `adminOnly` incompletos).
5. **`canDeleteAccount`** sem superfície de UI.
6. **Transfer ownership**: backend ok; Members tab ainda indica UI futura.
7. **Quick replies** = operacional (`agent+`) dentro de Settings (percebido como admin).
8. **Sidebar** mostra os mesmos links para todos os roles; o bloqueio é por ação/RLS, não por menu.

---

## 11. Checklist rápido para PRs

- [ ] Capability nova passou por `roles.ts`?
- [ ] API usa `requireRole` + `toErrorResponse`?
- [ ] Migration RLS usa `is_account_member(..., min_role)` correto?
- [ ] UI usa `useCan` / `RequireRole` (fail-closed no loading)?
- [ ] Convite nunca atribui `owner`?
- [ ] Não confiar em `profiles.role` (legado)?
- [ ] Não confundir `sender_type: 'agent'` com `account_role: 'agent'`?

---

## 12. Arquivos-chave (atalho)

```
src/lib/auth/roles.ts
src/lib/auth/account.ts
src/lib/auth/api-context.ts
src/lib/auth/invitations.ts
src/lib/api-keys/scopes.ts
src/hooks/use-auth.tsx
src/hooks/use-can.ts
src/components/auth/require-role.tsx
src/components/settings/role-meta.ts
src/middleware.ts
supabase/migrations/017_account_sharing.sql
supabase/migrations/018_account_member_rpcs.sql
supabase/migrations/019_invitation_rpcs.sql
supabase/migrations/034_fix_profiles_update_rls.sql
```
