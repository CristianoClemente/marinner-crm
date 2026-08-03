# Design: Documentos de habilitação (geração PDF)

**Data:** 2026-08-03  
**Status:** implementado (v1 — QA visual dos PDFs vs anexos ainda recomendado)  
**Abordagem:** 1 — HTML tipográfico fiel ao anexo + PDF via Chromium (Playwright)  
**Epic:** `docs/superpowers/specs/2026-07-30-process-oriented-school-epic-design.md`  
**UI:** modo Operate (Impeccable) — ações nas superfícies existentes, sem hub `/documents`

## Norte

A escola gera PDFs de **habilitação** fiéis aos anexos NORMAM, preenchidos com dados do CRM (contato, processo, turma, instrutor, local). O PDF é para **imprimir e assinar fora** do app (cartório ou GOV.BR). O Marinner não substitui a Autoridade Marítima.

Referência normativa (layout e campos; não compliance automático):

- `docs/normam-211.pdf` — An. **5-E** (atestado Arrais), **2-G** (residência), **5-H** (requerimento)
- `docs/normam-212.pdf` — An. **3-B** (atestado Motonauta), **1-C** (residência), **3-A** (requerimento)

Disclaimer de produto (UI + PDF meta): modelo operacional da escola; **não substitui** a NORMAM / decisão da CP/DL/AG.

## Decisões fechadas

| Tema | Decisão |
|------|---------|
| Escopo v1 | Só habilitação: atestados Arrais/Motonauta, declaração de residência, requerimento Capitania |
| Fora | Veleiro 5-G, 2ª via CHA, revisão de prova, despachante, EAMA/aluguel, assinatura digital no app |
| Assinatura | PDF para impressão; assinatura fora do Marinner |
| Fidelidade | Recriar layout do anexo em HTML/CSS (sem fundo/scan oficial); QA visual vs páginas oficiais antes do aceite |
| Motor | HTML → Playwright (Chromium) → PDF |
| Atestados | Só com **turma** (Agenda); precisa data, instrutor e local |
| Atestados · gatilho | **Lote** ao fechar turma + **individual** (reemitir) por enrollment |
| Residência | Gerar em **Inbox**, **Funil** ou **Contato** |
| Requerimento | Gerar só no **Funil** (processo); variante 5-H vs 3-A conforme o template do processo |
| Derivação Arrais vs Motonauta | Pelo template do processo (ex.: preset `arrais_amador` / `motonauta`, ou flag/metadado equivalente no template); sem escolha manual ambígua no lote |
| Fechar turma | Continua **não** avançando processo; pode disparar lote de atestados |
| Persistência | Cada geração = novo objeto R2 + linha em `generated_documents` (reemitir não sobrescreve) |
| Role v1 | Gerar = **admin+** |
| UI | Sem rota `/documents`; ações contextuais + `GenerateDocumentDialog` compartilhado |

## Modelos v1

| `kind` | Documento | Norma |
|--------|-----------|--------|
| `atestado_arrais` | Atestado de treinamento Arrais-Amador | 211 An. 5-E |
| `atestado_motonauta` | Atestado de treinamento Motonauta | 212 An. 3-B |
| `declaracao_residencia` | Declaração de residência | 211 2-G / 212 1-C (mesmo conteúdo legal) |
| `requerimento_capitania` | Requerimento à CP/DL/AG | 211 5-H **ou** 212 3-A conforme funil |

## Superfícies e dados

### Onde gera

| Modelo | Superfície | Ação |
|--------|------------|------|
| Atestados | Agenda → `/agenda/turmas/[id]` | Lote (fechar / “Gerar atestados”) + individual por aluno |
| Residência | Inbox · Funil · Contato | “Gerar declaração de residência” |
| Requerimento | Funil (painel do processo) | “Gerar requerimento” + opção de serviço do anexo |

### Dados obrigatórios

**Atestados**

- Aluno: nome, CPF (contato do processo)
- Turma: `starts_at`; horas/duração editáveis no dialog se necessário
- Local: `class_locations` (turma.location_id obrigatório)
- Instrutor: nome, CHA/doc (`instructors`; bloquear se `instructor_id` nulo)
- Escola: nome do ETN (conta / branding)
- Plano teórico/prático: checklist alinhado ao anexo (defaults do template + ajustes no dialog)

**Residência:** nome, CPF, endereço completo do contato.

**Requerimento:** dados cadastrais do contato + **uma** opção de serviço marcada no dialog + vínculo ao processo.

### Regras

- Sem instrutor, sem local ou turma sem alunos → erro claro; sem PDF parcial no lote (ou lote com relatório ok/falha por aluno se alguns tiverem contato incompleto)
- Dialog de fechar: primary **Fechar e gerar atestados** (bloqueia se faltar instrutor/local/mínimo de dados); secondary **Só fechar** (fecha sem PDF)

## Arquitetura

```text
CRM (contato / processo / process_classes / instructors / locations)
        │
        ▼
src/lib/documents/
  ├─ kinds + validate payload
  ├─ templates/     HTML+CSS por kind (template_version)
  └─ render-pdf.ts  Playwright print
        │
        ▼
R2 (process-docs / prefix documents/)
        │
        ▼
generated_documents (+ download API)
```

### APIs (esboço)

| Método | Rota | Uso |
|--------|------|-----|
| `POST` | `/api/documents/generate` | `kind` + contexto (`classId` / `enrollmentId` / `processId` / `contactId`) + opções |
| `POST` | `/api/classes/[id]/documents/atestados` | Lote (também acionado no fluxo de fechar) |
| `GET` | `/api/documents` | Lista por contato / processo / turma |
| `GET` | `/api/documents/[id]/download` | URL assinada ou redirect |

Auth: `requireRole` / `getCurrentAccount` + `toErrorResponse`; gerar = admin+.

### Schema

```text
generated_documents
  id, account_id
  kind          -- atestado_arrais | atestado_motonauta | declaracao_residencia | requerimento_capitania
  template_version
  contact_id
  process_id nullable
  class_id nullable
  enrollment_id nullable
  storage_path, file_name
  payload jsonb -- snapshot dos dados usados (auditoria / reemitir)
  created_by_user_id, created_at
```

RLS multi-tenant via `account_id`.

### Ops

- Chromium/Playwright no host de deploy (documentar em `.env.local.example` / runbook)
- Testes automatizados: validação de payload + smoke HTML
- Aceite de fidelidade: QA humano dos 4 PDFs vs anexos oficiais

## UI (Operate)

### Tese

Ferramenta densa, affordances nativas (Button `h-8`, Dialog só com opções, toast sonner). Sem preview do anexo no tema dark — o artefato é o PDF A4. Sem hub `/documents` na v1.

### Agenda · turma

1. **Fechar:** dialog “Fechar e gerar atestados?” (tipo derivado do funil da etapa; horas; disclaimer). Sucesso → turma `closed` + resumo N ok / falhas + downloads.
2. Turma já `closed`: outline **Gerar atestados** (mesmo dialog).
3. Por aluno: **Gerar atestado** / **Reemitir** (nova emissão; histórico preservado).

### Funil

- Bloco **Documentos** no slideover/painel do processo: Requerimento · Declaração de residência.
- Requerimento: dialog com opções do anexo (uma por emissão).
- Lista densa: tipo · data · quem · baixar / reemitir.

### Contato e Inbox

- Só **Declaração de residência** (ações do contato / painel da conversa).

### Componente

`GenerateDocumentDialog`: resumo dos dados que entram no PDF, gaps em destructive, disclaimer `text-xs text-muted-foreground`, primary **Gerar PDF**, loading no botão.

### Estados

| Estado | Comportamento |
|--------|----------------|
| Loading | Botão disabled + spinner |
| Sucesso | Toast + download / link Baixar |
| Dados faltando | Não chama API; lista o que falta |
| Lote parcial | Aviso + ok/erro por aluno |
| Sem permissão | Ação oculta |
| Turma vazia / cancelada | Sem gerar |
| Erro de render | Toast; sem registro de sucesso |

### Anti-metas de UI

- Não criar `/documents` na v1
- Não preview “CRM” do formulário Marinha
- Não seletor genérico de qualquer documento em toda superfície
- Não badges coloridos decorativos em docs

## Fora de escopo (v1)

- Automações engine (evento → doc) além do hook in-process no fechar turma
- Envio automático do PDF no WhatsApp
- Assinatura ICP-Brasil / GOV.BR nativa
- Modelos de embarcação / marina / EAMA
- Veleiro An. 5-G
- Presença multi-sessão na turma (atestado usa dados da turma atual)

## Critérios de aceite

1. Quatro `kind` geram PDF baixável com dados reais do tenant.
2. QA visual: cada PDF reconhecível como o anexo correspondente (estrutura, campos, ordem).
3. Atestado recusado sem instrutor ou local; residência/requerimento recusados sem dados mínimos.
4. Lote + individual na turma; residência nas três superfícies; requerimento só no funil.
5. Reemitir cria novo registro; anterior permanece.
6. `npm run typecheck` e lint do escopo passam; vitest de validação/payload verde.

## Relação com o produto

- Turmas: `docs/superpowers/specs/2026-07-31-agenda-turma-slice1-design.md`
- Funis / processos: epic process-oriented + quick-starts
- Storage: bucket lógico `process-docs` / R2 existente
