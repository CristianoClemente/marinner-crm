# Design: Epic — Escola náutica orientada a processos (habilitação)

**Data:** 2026-07-30  
**Status:** aprovado (mapa do epic — aguardando specs por fatia)  
**Abordagem:** 1 — motor de processo + templates  
**Próximo:** detalhar fatia 1 (motor) em spec própria

## Norte do produto

O Marinner deixa de ser “CRM WhatsApp com módulos de escola” e passa a ser **gestão de escola náutica orientada a processos**, tendo como ciclo principal a **habilitação**. O CRM (inbox, funil, broadcasts) permanece como suporte comercial/atendimento.

Ciclo de negócio (exemplo operacional):

```text
Contato (lead)
  → torna-se aluno (mesmo registro)
  → entra em processo(s) de habilitação
  → documentação / pagamento / aula prática / curso / prova
  → aprovado → habilitado → fim do ciclo daquele processo
```

## Decisões de contexto (fechadas)

| Tema | Decisão |
|------|---------|
| Processos por contato | **Vários em paralelo** |
| Aluno | Mesmo `contacts` (sem tabela `students`) |
| Etapas | **Genéricas**, configuráveis por escola |
| Tipagem de etapa | **Não** nesta fase; comportamento especial nas fatias (docs, aula…) |
| Funil × processo | **Independentes**; abertura manual agora; **automação** “deal ganho → processo” depois |
| Home | **Dashboard operacional** (contagens + atalhos); inbox e processos ao lado |
| Templates | Ligados a **produto do catálogo** |
| Navegação de etapas | **Sequencial** + flag `allow_skip` por template |
| Instrutor | Pode **avançar etapas de aula/prática** nos processos em que participa |
| Automações | Consumir **eventos de domínio** emitidos desde a fatia 1 |

### Por que funil ≠ processo (escala)

Funil mede **venda**; processo mede **execução escolar**. Separar permite multi-CHA no mesmo contato, papéis distintos (agent vs operação vs instrutor) e automações com gatilhos claros — sem misturar “ganhou” com “aguardando documentação”.

## Fatias do epic

| # | Fatia | Entrega | Spec |
|---|--------|---------|------|
| 0 | Mapa (este doc) | Vocabulário, entidades, eventos, ordem | ✅ |
| 1 | Motor de processo | Templates, etapas, processos, avanço, listagem | pendente |
| 2 | Documentação | Checklist + upload R2 no processo | pendente |
| 3 | Pagamento | Vínculo PDV/venda/parcelas ao processo | pendente |
| 4 | Aula prática | Agenda (instrutor, local, equipamento) + avanço | pendente |
| 5 | Prova + conclusão | Resultado, habilitado, encerramento | pendente |
| 6 | Home escola-first | Dashboard + navegação; CRM como suporte | pendente |
| 7 | Automações | Triggers nos eventos (+ opcional deal → processo) | pendente |

Cada fatia terá **spec + plano + implementação** próprios. Não implementar o epic de uma vez.

## Modelo de domínio (alvo)

```text
catalog_products
       │
process_templates (account_id, product_id, name, allow_skip default/policy)
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

Fatias 2–5 anexam: documents | payment_links | lessons | exams
```

Nomes de tabela podem ajustar na spec da fatia 1; o contrato conceitual permanece.

## Eventos de domínio (contrato estável)

Emitidos na fatia 1 (mesmo sem consumer):

| Evento | Quando |
|--------|--------|
| `process.created` | Processo aberto no contato |
| `process.stage_changed` | Avanço/retrocesso de etapa |
| `process.completed` | Ciclo concluído (habilitado) |
| `process.canceled` | Processo cancelado |

Payload mínimo: `account_id`, `process_id`, `contact_id`, `template_id`, timestamps, `actor_user_id` quando houver. Fatia 7 registra esses triggers no motor de automações existente.

## UX alvo (fatia 6)

- Home: dashboard (processos por etapa/template, atalhos).
- Nav: Processos · Inbox · Contatos · Funil · Catálogo/PDV · Locais/Frota/Instrutores · Config.
- Contato: aba Processos (N paralelos) + WhatsApp.
- Instrutor: sem CRM operacional; aulas + avanço permitido.

## Fora de escopo do epic

- Tipar etapas no motor (`documentos` / `prova` como tipos de engine)
- LMS / portal do aluno
- Integração Marinha / órgãos externos
- Hardcode “deal ganho → processo” sem fatia de automações
- Substituir ou eliminar o funil comercial

## Relação com o que já existe

| Módulo atual | Papel no epic |
|--------------|---------------|
| Contatos / inbox / funil | Lead e atendimento; entrada comercial |
| Catálogo / PDV | Produto ↔ template; pagamento (fatia 3) |
| Locais / equipamentos / instrutores | Aula prática (fatia 4) |
| Automações / fluxos WhatsApp | Fatia 7 + canal de comunicação |
| R2 / retenção chat | Docs de processo (fatia 2) em bucket/prefixo próprio |

## Atualização de produto

Ao iniciar a fatia 1, atualizar `PRODUCT.md`: propósito e “em aberto” passam a citar o **processo de habilitação** como core; módulos acadêmicos deixam de ser apenas “em aberto” genérico.

## Critério de sucesso do epic

Com fatias 1–7 entregues: a escola opera o dia a dia pelo **dashboard de processos**; um contato pode ter vários processos ligados a produtos; etapas avançam com histórico; docs/pagamento/aula/prova se apoiam no mesmo processo; automações reagem a eventos.

## Próximo passo

1. Review humano deste mapa.  
2. Spec detalhada da **fatia 1 — Motor de processo**.  
3. Plano + implementação da fatia 1.
