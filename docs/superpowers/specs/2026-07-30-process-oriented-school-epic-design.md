# Design: Epic — Escola náutica orientada a processos (habilitação)

**Data:** 2026-07-30  
**Status:** Kanban unificado em implementação — próximo após: fatia 3 (pagamento)  
**Abordagem:** 1 — motor de processo + templates (capacidades cobrem venda e operação)  
**Próximo:** spec da fatia 3 — vínculo PDV/venda/parcelas ao processo

## Norte do produto

O Marinner deixa de ser “CRM WhatsApp com módulos de escola” e passa a ser **gestão de escola náutica orientada a processos**, tendo como ciclo principal a **habilitação**. Comercial e operação compartilham o **mesmo Kanban/motor**; diferem por **capacidades do template**. Inbox e broadcasts seguem como suporte de atendimento.

Ciclo de negócio (exemplo operacional):

```text
Contato (lead)
  → torna-se aluno (mesmo registro)
  → entra em um ou mais processos em paralelo
       (ex.: habilitação + despachante)
  → cada processo sobe suas etapas até conclusão
```

## Decisões de contexto (fechadas)


| Tema                  | Decisão                                                                                |
| --------------------- | -------------------------------------------------------------------------------------- |
| Processos por contato | **Vários em paralelo** (ex.: habilitação **e** despachante ao mesmo tempo)             |
| Aluno                 | Mesmo `contacts` (sem tabela `students`)                                               |
| Etapas                | **Genéricas**, configuráveis por escola                                                |
| Tipagem de etapa      | **Não** nesta fase; comportamento especial nas fatias (docs, aula…)                    |
| Funil × processo      | **Mesmo motor**; diferença por capacidades (`advance_mode`, valor, outcome, catálogo) |
| Home                  | **Dashboard operacional** (contagens + atalhos); inbox e processos ao lado             |
| Templates             | Catálogo **opcional** (`requires_catalog_item`); venda pode existir sem produto        |
| Navegação de etapas   | `advance_mode`: `free` \| `sequential` (+ `allow_skip` no sequencial)                  |
| Instrutor             | Pode **avançar etapas de aula/prática** nos processos em que participa                 |
| Automações            | Consumir **eventos de domínio** emitidos desde a fatia 1                               |


### Venda × operação (capacidades, não dois módulos)

Funil mede **venda**; processo operacional mede **execução** (escola / serviços). Antes isso vivia em dois Kanbans (`pipelines` vs `process_*`). A unificação (spec `2026-08-03-unified-kanban-design.md`) mantém a diferença semântica via **flags do template** no mesmo motor:

- venda típica: `advance_mode=free`, `has_monetary_value`, `has_commercial_outcome`, sem catálogo obrigatório;
- habilitação típica: `sequential`, campos por etapa, turmas, `requires_catalog_item`.

**Vários em paralelo** continua: o mesmo aluno pode ter habilitação **e** despachante (templates distintos). Papéis (comercial vs operação vs instrutor) e eventos `process.*` permanecem; o antigo `create_deal` vira abertura de instância em template comercial.

## Fatias do epic


| #   | Fatia             | Entrega                                           | Spec / status |
| --- | ----------------- | ------------------------------------------------- | ------------- |
| 0   | Mapa (este doc)   | Vocabulário, entidades, eventos, ordem            | ✅            |
| 1   | Motor de processo | Templates, etapas, processos, avanço, Operate UI  | ✅ `2026-07-30-process-engine-slice1-design.md` |
| 2   | Campos por etapa  | Formulário configurável + file no R2 + gate soft/hard | ✅ `2026-07-30-process-stage-fields-slice2-design.md` |
| 2b  | Kanban unificado  | Capacidades + migrar funil comercial + um board/builder | 🔧 `2026-08-03-unified-kanban-design.md` |
| 3   | Pagamento         | Vínculo PDV/venda/parcelas ao processo            | pendente |
| 4   | Aula prática      | Agenda + evento Turma (ops; finanças depois)      | ✅ `2026-07-31-agenda-turma-slice1-design.md` |
| 5   | Prova + conclusão | Resultado, habilitado, encerramento               | pendente |
| 6   | Home escola-first | Dashboard + navegação; CRM como suporte           | pendente |
| 7   | Automações        | Triggers nos eventos (+ opcional deal → processo) | pendente |


Cada fatia terá **spec + plano + implementação** próprios. Não implementar o epic de uma vez.

## Estado atual (pós-fatia 1)

Base pronta no código — a fatia 2 **anexa** campos por etapa ao processo existente; não redesenha o motor.

### Domínio e APIs

- Tabelas: `process_templates`, `process_template_stages`, `enrollment_processes`, `process_stage_history`, `process_domain_events` (migration 054).
- APIs: CRUD templates/etapas; `GET/POST /api/processes`; `GET /api/processes/[id]` (processo + history + stages); `POST …/advance|complete|cancel`.
- Eventos na outbox: `process.created`, `process.stage_changed`, `process.completed`, `process.canceled` (sem consumer — fatia 7).
- Roles: templates admin+; operar processos agent+ (`send-messages`); leitura viewer+.

### UI Operate (reforço pós-crítica)

Superfície `/processes` alinhada à ponte de comando, não só esqueleto de fatia 1:

- Board **exige um template** (default = primeiro ativo com etapas); “Todos os templates” vira lista plana.
- Colunas = etapas do template por `position` (vazias inclusas), com progresso “Etapa N de M”.
- Confirmação antes de Avançar / Concluir / Cancelar (preview da próxima etapa; aviso se avanço conclui).
- Menu por card + sheet de detalhe (histórico, meta do aluno, link ao contato via `ContactDetailView`).
- Status em pt-BR; empty states com CTA; header compacto no mobile; aviso de processo paralelo/duplicado ao abrir.
- Contato: aba Processos (`ContactProcessesPanel`) com as mesmas ações de ciclo.
- Templates: `/process-templates`.

### Fundações reutilizáveis na fatia 2

| Peça | Onde | Uso na fatia 2 |
|------|------|----------------|
| Sheet de detalhe | `ProcessDetailSheet` | Histórico + ciclo; atalho para preencher |
| Slideover de campos | a criar (`ProcessStageFieldsSheet`) | Formulário da etapa atual + Salvar |
| R2 / storage | `docs/cloudflare-r2-storage.md`, `src/lib/storage/*` | Novo bucket lógico `process-docs` (prefix `processes/`) |
| Contato + processo | `contact_id` no enrollment | Valores escopados a `account_id` + `process_id` |
| Eventos | outbox | Campo/arquivo **não** emitidos na fatia 2 |

### Dívida consciente (não bloqueia fatia 2)

- Sem undo / voltar etapa (API só avança).
- Sem busca no board, lote ou DnD.
- Sem snapshot de etapas na abertura (template vivo).
- `PRODUCT.md` já cita processos; “em aberto” ainda lista documentos/pagamento/aula/prova/dashboard — atualizar ao fechar cada fatia.

## Modelo de domínio (alvo)

```text
catalog_items
       │
process_templates (account_id, catalog_item_id, name, active)
       │
process_template_stages (name, position, allow_skip)

contacts
       │
enrollment_processes
  template_id, contact_id, account_id
  current_stage_id, status (active|completed|canceled)
  opened_at, completed_at, canceled_at
       │
process_stage_history (from_stage, to_stage, actor_user_id, at)

Fatias 2–5 anexam: stage_fields/values | payment_links | lessons | exams
```

## Eventos de domínio (contrato estável)

Emitidos desde a fatia 1 (mesmo sem consumer):


| Evento                  | Quando                       |
| ----------------------- | ---------------------------- |
| `process.created`       | Processo aberto no contato   |
| `process.stage_changed` | Avanço/retrocesso de etapa   |
| `process.completed`     | Ciclo concluído (habilitado) |
| `process.canceled`      | Processo cancelado           |


Payload mínimo: `account_id`, `process_id`, `contact_id`, `template_id`, timestamps, `actor_user_id` quando houver. Fatia 7 registra esses triggers no motor de automações existente.

Eventos de campo/arquivo (`process.field_*` / `process.file_*`) — **adiados** (fatia 2 não emite; fatia 7 decide).

## Fatia 2 — Campos por etapa (spec fechada)

Spec: `2026-07-30-process-stage-fields-slice2-design.md`.

Resumo: campos por `process_template_stages` (`file|checkbox|text|textarea|date|select`); valores em `process_field_values`; bucket lógico `process-docs`; UI = **slideover da etapa + Salvar único**; gate soft default / hard via `block_advance_if_incomplete`; só etapa atual; builder no editor de template atual.

## UX alvo (fatia 6)

- Home: dashboard (processos por etapa/template, atalhos).
- Nav: Processos (Kanban) · Funis · Inbox · Contatos · Catálogo/PDV · Locais/Frota/Instrutores · Config.
- Contato: aba Processos (N paralelos) + WhatsApp.
- Instrutor: sem CRM operacional; aulas + avanço permitido.

## Fora de escopo do epic

- Tipar etapas no motor (`documentos` / `prova` como tipos de engine)
- LMS / portal do aluno
- Hardcode “deal ganho → processo operacional” sem fatia de automações (ambos já são o mesmo motor)

## Relação com o que já existe


| Módulo atual                        | Papel no epic                                        |
| ----------------------------------- | ---------------------------------------------------- |
| Contatos / inbox / Kanban unificado | Lead, atendimento e funis (venda + operação)         |
| Catálogo / PDV                      | Produto ↔ template; pagamento (fatia 3)              |
| Locais / equipamentos / instrutores | Aula prática (fatia 4)                               |
| Automações / fluxos WhatsApp        | Fatia 7 + canal de comunicação                       |
| R2 / retenção chat                  | Arquivos de campo `file` (fatia 2) em prefixo `processes/` |
| `/processes` + sheets               | Board + slideover de campos + detalhe/histórico (fatia 2) |


## Atualização de produto

- Fatia 1: `PRODUCT.md` já lista processos operacionais como confirmados.
- Ao **fechar a implementação da fatia 2**, mover “campos/documentos no processo” de “em aberto” para confirmado; manter pagamento/aula/prova/dashboard em aberto.

## Critério de sucesso do epic

Com fatias 1–7 entregues: a escola opera o dia a dia pelo **dashboard de processos**; um contato pode ter vários processos ligados a produtos; etapas avançam com histórico; campos/docs/pagamento/aula/prova se apoiam no mesmo processo; automações reagem a eventos.

## Próximo passo

1. ~~Review humano deste mapa.~~
2. ~~Spec + plano + implementação da fatia 1.~~
3. ~~Spec + implementação da fatia 2 — Campos por etapa.~~
4. **Smoke manual** na UI (template com campos → board → slideover Salvar → avanço soft/hard).
5. Spec da fatia 3 — Pagamento.
