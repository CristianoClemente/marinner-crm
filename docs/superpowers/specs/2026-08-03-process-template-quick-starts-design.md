# Design: Modelos de início rápido para funis (process templates)

**Data:** 2026-08-03  
**Status:** aprovado em brainstorm — aguardando plano de implementação  
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
| Escopo v1 | 1 funil comercial + Arrais-Amador + Motonauta |
| Clique no card | Abre dialog pré-preenchido (não cria no banco) |
| Conteúdo | Etapas + capacidades + campos essenciais por etapa |
| Persistência | Catálogo estático em `src/lib/processes/quick-start-templates.ts` |
| API | Nenhuma nova; Salvar = `POST` template + `PUT` stages + `PUT` fields |
| Galeria | Sempre visível para quem gerencia funis (`edit-settings`) |
| “Novo funil” | Continua dialog em branco (defaults atuais) |
| Catálogo (habilitação) | `requires_catalog_item=true`; escola escolhe serviço antes de salvar |
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
- `icon`: nome lucide estável (ex. `Handshake`, `Ship`, `Waves`)
- `capabilities`: flags do template unificado (`advance_mode`, `has_monetary_value`, `has_commercial_outcome`, `requires_catalog_item`, `block_advance_if_incomplete`)
- `stages[]`: `{ name, allow_skip, accepts_classes, fields[] }`
- `fields[]`: mesmo shape do draft do builder (`label`, `field_type`, `required`, `options` quando select)

Nome/descrição **não** ficam hardcoded em EN no módulo — chaves i18n `Processes.templates.quickStart.*`.

### UI

- Seção “Modelos de início rápido” no topo (grid responsivo como Automações)
- Card: ícone + título + descrição curta; hover no idioma Operate
- Clique → `openCreateFromPreset`: zera `editing`, aplica draft, `setOpen(true)`
- Hint no dialog quando veio de preset (ex.: “Modelo de início rápido — revise antes de salvar”)
- Empty state da lista: “Escolha um modelo acima ou crie do zero”

## Conteúdo dos presets

### `sales_pipeline` — Funil comercial

| Capacidade | Valor |
|---|---|
| `advance_mode` | `free` |
| `has_monetary_value` | true |
| `has_commercial_outcome` | true |
| `requires_catalog_item` | false |
| `block_advance_if_incomplete` | false |

Etapas: Qualificação → Proposta → Negociação → Fechamento.

Campos (mínimos): nota/contexto em Qualificação (textarea); valor esperado em Proposta (text). Sem `accepts_classes`.

### `arrais_amador` — Arrais-Amador (NORMAM-211)

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

### `motonauta` — Motonauta (NORMAM-212)

Mesma estrutura operacional do Arrais (sequential + catálogo + block + turmas na prática). Campos espelham inscrição MTA: docs + atestado de treinamento Motonauta + exame + CHA-MTA (rótulos i18n distintos).

## Estados e erros

- Clique no preset: só estado local — sem toast de rede
- Salvar: validações existentes (nome; catálogo se exigido; nomes de etapa; labels/opções de campo)
- Cancelar / fechar dialog: descarta o draft do preset
- Escola pode editar livremente o draft antes de salvar

## Testes

- Unitário em `quick-start-templates.test.ts`:
  - 3 slugs presentes e shapes válidos
  - comercial: `free`, sem exigir catálogo
  - Arrais/Motonauta: `sequential`, `requires_catalog_item`, etapa prática com `accepts_classes`, Documentação/Prova com campos
- Sem E2E obrigatório na v1

## Fora de escopo

- Seed automático em contas novas
- Endpoint `/presets` ou sync quando a NORMA mudar
- Criar item de catálogo junto com o funil
- Presets no Kanban `/processes`
- Outras categorias (Veleiro, Mestre, Capitão) — fatias futuras

## Critérios de sucesso

- Galeria com 3 cards em `/process-templates`
- Clique abre dialog preenchido; Salvar cria funil usável no Kanban
- Comercial e habilitação diferem por capacidades sem dois builders
- typecheck/lint/testes do módulo passam
- Copy deixa claro que o modelo não substitui a norma

## Relação com o epic

Complementa o criador de funis do Kanban unificado (`2026-08-03-unified-kanban-design.md`) e o motor de processos/campos (fatias 1–2). Não altera o schema.
