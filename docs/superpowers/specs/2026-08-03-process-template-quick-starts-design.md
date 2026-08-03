# Design: Modelos de início rápido para funis (process templates)

**Data:** 2026-08-03  
**Status:** implementado  
**Abordagem:** 1 — catálogo estático em código (padrão Automações/Fluxos)

## Norte

Em `/process-templates`, a escola escolhe um **modelo de início rápido** que abre o dialog de criação **já preenchido** (capacidades, etapas e campos). Revisar e Salvar usam as APIs atuais — sem gravar no banco no clique do card.

Referência normativa (somente seed operacional, não compliance automático):

- `docs/normam-211.pdf` — amadores / Arrais-Amador (Cap. 5)
- `docs/normam-212.pdf` — Motonauta (Cap. 3)

Disclaimer de produto (UI + copy): modelo da escola; **não substitui** a NORMAM.

## Decisões fechadas

| Tema | Decisão |
|------|---------|
| Taxonomia de produto | Dois papéis de funil: **venda** e **processo** (não “comercial vs habilitação”) |
| Processo na v1 | Presets de processo = Arrais-Amador e Motonauta; **despachante** e outras categorias = fatias futuras no mesmo papel |
| Escopo v1 | 1 funil de venda + 2 processos (Arrais, Motonauta) |
| Clique no card | Abre dialog pré-preenchido (não cria no banco) |
| Conteúdo | Etapas + capacidades + campos essenciais por etapa |
| Persistência | Catálogo estático em `src/lib/processes/quick-start-templates.ts` |
| API | Nenhuma nova; Salvar = `POST` template + `PUT` stages + `PUT` fields |
| Galeria | Sempre visível; cards com ícone + título + descrição + **meta** (etapas · modo · venda\|processo) |
| Dialog pós-preset | Hint no header apenas (sem preview de etapas); form pré-preenchido |
| “Novo funil” | Continua dialog em branco (defaults atuais) |
| Catálogo (processo) | `requires_catalog_item=true` nos presets de processo; escola escolhe serviço antes de salvar |
| Norma | Seed inspirado na NORMAM; campos editáveis no dialog |

## Arquitetura

```text
messages/pt-BR.json  (nome/descrição dos cards)
        │
src/lib/processes/quick-start-templates.ts
        │  slug → capabilities + stages[] + fields[]
        ▼
/process-templates page
  ├─ galeria (3 cards)
  └─ Dialog existente ← openCreateFromPreset(slug)
           │
           ▼ Salvar
     APIs process-templates atuais
```

### Módulo de presets

Cada preset expõe:

- `slug`: `sales_pipeline` \| `arrais_amador` \| `motonauta`
- `kind`: `sale` \| `process` — taxonomia de produto (UI: “venda” / “processo”); habilita presets futuros (ex. despachante) sem novo eixo
- `icon`: nome lucide estável (ex. `Handshake`, `Ship`, `Waves`)
- `capabilities`: flags do template unificado (`advance_mode`, `has_monetary_value`, `has_commercial_outcome`, `requires_catalog_item`, `block_advance_if_incomplete`)
- `stages[]`: `{ name, allow_skip, accepts_classes, fields[] }`
- `fields[]`: mesmo shape do draft do builder (`label`, `field_type`, `required`, `options` quando select)

Nome/descrição **não** ficam hardcoded em EN no módulo — chaves i18n `Processes.templates.quickStart.*`.

### UI / UX (shape Operate)

**Modo:** Operate — densidade de ferramenta; galeria para decidir rápido, dialog para revisar e salvar.

**Job:** admin/owner em `/process-templates` escolhe um seed (**venda** ou **processo**) sem montar funil do zero; o dialog pré-preenchido é o lugar da edição.

**Taxonomia (copy e meta)**

- Papéis: **venda** (funil comercial) e **processo** (execução operacional).
- Na v1, presets de processo são Arrais e Motonauta; copy **não** trata “habilitação” como o oposto de venda — habilitação é um *tipo* de processo (como despachante será depois).
- Sem chip de categoria; o papel entra na **meta** do card.

**Galeria (cards) — decisão 1B**

- Seção “Modelos de início rápido” no topo, sempre visível para quem gerencia funis.
- Grid responsivo: `1` → `2` (md) → `3` (xl) colunas (3 presets; não forçar 4 como Automações).
- Card (botão): ícone em tint `primary-soft` · título `text-sm font-semibold` · descrição `text-xs muted` · **meta densa** `text-xs muted` numa linha, ex.:
  - Venda: `4 etapas · livre · venda`
  - Arrais / Motonauta: `5 etapas · sequencial · processo`
- Hover: `border-primary/50` + fundo sutil (padrão Automações); foco teclado visível.
- Clique → `openCreateFromPreset(slug)` (só estado local).

**Dialog a partir de preset — decisão 2A**

- Mesmo dialog de criar (header/footer fixos, corpo rolável).
- Hint único no header/descrição: “Modelo de início rápido — revise antes de salvar.” Nos presets NORMAM, acrescentar: “Não substitui a NORMAM.”
- **Sem** preview/lista de etapas no topo do dialog (o form já traz etapas+campos).
- Título permanece “Novo funil” (ou equivalente i18n); o nome do preset já vem no campo Nome.
- “Novo funil” em branco continua disponível; empty state da lista: “Escolha um modelo acima ou crie do zero”.

**Hierarquia tipográfica (já alinhada ao polish do modal)**

- Seções do form: `text-base`; controles `text-sm`; meta/hints `text-xs`.

**Anti-goals de UI**

- Não transformar a galeria em landing (hero, stats, badges ornamentais).
- Não duplicar a estrutura do funil como “preview” dentro do dialog.
- Não criar segundo builder só para presets.
- Não rotular o eixo como “comercial vs habilitação” — isso trava despachante e outros processos.

## Conteúdo dos presets

### `sales_pipeline` — Funil de venda (`kind: sale`)

| Capacidade | Valor |
|---|---|
| `advance_mode` | `free` |
| `has_monetary_value` | true |
| `has_commercial_outcome` | true |
| `requires_catalog_item` | false |
| `block_advance_if_incomplete` | false |

Etapas: Qualificação → Proposta → Negociação → Fechamento.

Campos (mínimos): nota/contexto em Qualificação (textarea); valor esperado em Proposta (text). Sem `accepts_classes`.

### `arrais_amador` — Arrais-Amador (`kind: process`, NORMAM-211)

| Capacidade | Valor |
|---|---|
| `advance_mode` | `sequential` |
| `has_monetary_value` | false |
| `has_commercial_outcome` | false |
| `requires_catalog_item` | true |
| `block_advance_if_incomplete` | true |

Etapas e campos essenciais:

| Etapa | Flags | Campos |
|---|---|---|
| Documentação | — | 4 campos `file` obrigatórios: RG/CPF, comprovante de residência, atestado médico, GRU |
| Pagamento | — | file: comprovante de pagamento |
| Aula prática | `accepts_classes` | file: atestado de treinamento (Arrais) |
| Prova | — | date: data do exame; select: aprovado/reprovado |
| CHA emitida | — | date: data de emissão; text: número/observações |

### `motonauta` — Motonauta (`kind: process`, NORMAM-212)

Mesma estrutura operacional do Arrais (sequential + catálogo + block + turmas na prática). Campos espelham inscrição MTA: docs + atestado de treinamento Motonauta + exame + CHA-MTA (rótulos i18n distintos).

## Estados e erros

- Clique no preset: só estado local — sem toast de rede
- Salvar: validações existentes (nome; catálogo se exigido; nomes de etapa; labels/opções de campo)
- Cancelar / fechar dialog: descarta o draft do preset
- Escola pode editar livremente o draft antes de salvar

## Testes

- Unitário em `quick-start-templates.test.ts`:
  - 3 slugs presentes, `kind` sale|process, shapes válidos
  - venda: `free`, sem exigir catálogo
  - Arrais/Motonauta: `kind=process`, `sequential`, `requires_catalog_item`, etapa prática com `accepts_classes`, Documentação/Prova com campos
- Sem E2E obrigatório na v1

## Fora de escopo

- Seed automático em contas novas
- Endpoint `/presets` ou sync quando a NORMA mudar
- Criar item de catálogo junto com o funil
- Presets no Kanban `/processes`
- Outros **processos** (despachante, Veleiro, Mestre, Capitão, …) — fatias futuras no mesmo `kind: process`

## Critérios de sucesso

- Galeria com 3 cards (meta: etapas · modo · venda|processo) em `/process-templates`
- Clique abre dialog preenchido com hint; Salvar cria funil usável no Kanban
- Venda e processo diferem por capacidades/`kind` sem dois builders
- typecheck/lint/testes do módulo passam
- Copy deixa claro que o modelo não substitui a norma (presets NORMAM)

## Relação com o epic

Complementa o criador de funis do Kanban unificado (`2026-08-03-unified-kanban-design.md`) e o motor de processos/campos (fatias 1–2). Não altera o schema.
