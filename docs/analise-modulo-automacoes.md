# Análise do módulo de Automações

Documento de arquitetura com base no código atual do Marinner CRM (`src/lib/automations`, `src/components/automations`, APIs e inbound WhatsApp).

**Em uma frase:** motor de regras por conta (`account_id`): eventos disparam automações ativas, passos rodam em árvore (incluindo condição/wait), e envios saem pelo provider WhatsApp — texto funciona em Meta e Z-API; template e interativo exigem Meta.

| Métrica | Valor |
|---------|-------|
| Tipos de trigger | 8 |
| Tipos de passo | 13 |
| Templates prontos | 4 |
| Gaps críticos | 3+ |

---

## 1. Mapa do sistema

### UI / produto

| Rota | Arquivo |
|------|---------|
| `/automations` | `src/app/(dashboard)/automations/page.tsx` |
| `/automations/new` | `src/app/(dashboard)/automations/new/page.tsx` |
| `/automations/[id]/edit` | `src/app/(dashboard)/automations/[id]/edit/page.tsx` |
| `/automations/[id]/logs` | `src/app/(dashboard)/automations/[id]/logs/page.tsx` |

- Builder monolítico: `src/components/automations/automation-builder.tsx`
- Templates seed: welcome, out of office, lead qualifier, follow-up — `src/lib/automations/templates.ts` (nomes em inglês)
- Nav: Sidebar (`/automations`) e atalho no dashboard para `/automations/new`

### APIs

| Método | Path | Papel |
|--------|------|-------|
| GET/POST | `/api/automations` | Listar / criar |
| GET/PATCH/DELETE | `/api/automations/[id]` | Ler / editar / excluir |
| POST | `/api/automations/[id]/duplicate` | Duplicar |
| POST | `/api/automations/engine` | Disparo manual (teste) |
| GET | `/api/automations/cron` | Retomar waits (`x-cron-secret`) |

### Runtime

- Núcleo: `runAutomationsForTrigger` em `src/lib/automations/engine.ts` (service role; não propaga throw ao caller)
- Wait: tabela `automation_pending_executions` + cron acima
- Envio: `src/lib/automations/meta-send.ts` → provider abstrato

### Banco (migrations)

- `006_automations.sql` — tabelas + RLS inicial
- `007_automations_increment_counter.sql` — contador de execuções
- `017_account_sharing.sql` — `account_id` + RLS por membro da conta

**Tabelas:** `automations`, `automation_steps`, `automation_logs`, `automation_pending_executions`

---

## 2. Fluxo de execução

```
Evento
  → Dispatch (account_id + trigger_type + is_active)
  → triggerMatches (keyword / tag / interactive…)
  → Carrega automation_steps
  → Executa árvore (condition → yes/no; wait → pending)
  → Logs em automation_logs
  → Envio WhatsApp (se aplicável) com sender_type = bot
```

1. **Evento** — inbound WhatsApp (`process-message.ts`), tag adicionada (`tag-events.ts`), POST manual ou cron de wait
2. **Dispatch** — busca automações ativas; valida ownership do contato; aplica `triggerMatches`
3. **Passos** — árvore via `parent_step_id` + `branch`; wait grava pending
4. **Envio** — `meta-send.ts` → `createWhatsAppProviderFromConfig`

---

## 3. Triggers

| Trigger | Status no runtime | Notas |
|---------|-------------------|-------|
| `new_message_received` | Ativo | Inbound; omitido se um Flow consumiu a mensagem |
| `keyword_match` | Ativo | Inbound + keywords (`exact` / `contains`) |
| `first_inbound_message` | Ativo | Primeira mensagem do contato |
| `new_contact_created` | Ativo (parcial) | Só quando o contato nasce no **inbound** WhatsApp |
| `interactive_reply` | Ativo | Reply id de botão/lista |
| `tag_added` | Ativo | Via `tag-events`; limite de cadeia anti-loop |
| `conversation_assigned` | **UI only** | Existe no builder; sem dispatch no runtime |
| `time_based` | **UI only** | Schedule validado; cron **não** agenda esse trigger (só retoma waits) |

**Callers de `runAutomationsForTrigger`:** `process-message.ts`, `tag-events.ts`, `POST /api/automations/engine`, e reentrada via `add_tag` no próprio engine.

---

## 4. Passos (ações)

| Passo | WhatsApp / provider | Risco Z-API |
|-------|---------------------|-------------|
| `send_message` | Provider text | OK |
| `send_template` | Meta templates | Bloqueado (`assert template`) |
| `send_buttons` / `send_list` | Interactive via `flows/meta-send` | Bloqueado (sem interactive) |
| `add_tag` / `remove_tag` | CRM | OK |
| `assign_conversation` | CRM | OK (round-robin é stub) |
| `update_contact_field` | CRM (tenant-scoped) | OK — só `name` / `email` |
| `create_deal` | CRM funil | OK |
| `wait` | Pending + cron | OK |
| `condition` | Engine local | OK |
| `send_webhook` | HTTP + SSRF guard | OK |
| `close_conversation` | CRM | OK |

### Condições (`condition`)

Subjects: `contact_field`, `tag_presence`, `message_content`, `time_of_day` (janela `HH:mm-HH:mm`, overnight permitido).

---

## 5. Multi-tenant e segurança

### Pontos fortes

- Isolamento por `account_id` no dispatch
- Checagem de ownership do contato antes de executar (service role bypassa RLS)
- Webhook com guard SSRF
- Cron com secret timing-safe (`AUTOMATION_CRON_SECRET`)
- Testes de isolamento em `engine.test.ts`

### Atenções

- Engine usa admin client (bypass RLS) — defesa no código, não só no banco
- Lista na UI lê via cliente Supabase (RLS por membro da conta)
- Há `console.error` / `console.warn` no engine (observabilidade / ruído)
- **GET/PATCH/DELETE/duplicate** ainda filtram por `user_id` do autor → colegas da mesma conta veem a lista, mas não editam/duplicam/excluem automações de outro autor (inconsistente com sharing pós-017)

---

## 6. Automações vs Fluxos

| | Automações | Fluxos (`/flows`, beta) |
|--|------------|-------------------------|
| Modelo | if-this-then-that + árvore de passos | Grafo de nós / runs conversacionais |
| Forte em | tags, deals, wait, webhooks, texto | menus, botões, collect input |
| Inbound | Roda depois dos Flows | Primeiro; se `consumed`, suprime message/keyword/interactive automation |

Ambos disparam a partir de `process-message.ts`. Automações reutilizam helpers de interactive send dos Flows.

---

## 7. Gaps e oportunidades

### Críticos

1. **Triggers incompletos** — `conversation_assigned` e `time_based` no builder sem runtime; expectativa falsa para o usuário.
2. **Edição entre colegas quebrada** — APIs mutáveis ainda amarradas a `user_id` do autor.
3. **Z-API × envios ricos** — dá para ativar automação com template/botões/lista; falha só na execução. Falta gate no builder (como em Transmissões).

### Secundários

- `assign_conversation` round-robin é stub (`.limit(1)`)
- `new_contact_created` não dispara em cadastro manual/API — só criação no inbound
- Flow que consome mensagem pula vários triggers de automação (intencional, mas pouco documentado na UI)
- Campos custom/`company` no `update_contact_field` são soft-skipped
- Labels de trigger / templates seed ainda em inglês
- Cron de wait depende de configuração ops (`AUTOMATION_CRON_SECRET`); sem isso, passos `wait` não retomam

---

## 8. Arquivos-chave

```
src/lib/automations/engine.ts
src/lib/automations/meta-send.ts
src/lib/automations/validate.ts
src/lib/automations/templates.ts
src/lib/automations/trigger-meta.ts
src/lib/automations/steps-tree.ts
src/components/automations/automation-builder.tsx
src/lib/whatsapp/inbound/process-message.ts
src/lib/contacts/tag-events.ts
src/app/api/automations/**
supabase/migrations/006_automations.sql
supabase/migrations/007_automations_increment_counter.sql
supabase/migrations/017_account_sharing.sql
```

---

## 9. Próximos passos sugeridos (prioridade)

1. Corrigir ownership das APIs mutáveis para `account_id` / membership (não só `user_id`)
2. Esconder ou implementar `time_based` e `conversation_assigned`
3. Gate no builder para passos Meta-only quando a conta for Z-API
4. Completar round-robin ou remover a opção
5. i18n dos templates e pills de trigger (pt-BR)
