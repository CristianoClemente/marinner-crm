# Design: Fatia 2 — Campos configuráveis por etapa

**Data:** 2026-07-30  
**Status:** implementado (fatia 2)  
**Abordagem:** 1 — definição na etapa + valores no processo  
**Epic:** `docs/superpowers/specs/2026-07-30-process-oriented-school-epic-design.md`  
**Plano:** `docs/superpowers/plans/2026-07-30-process-stage-fields.md`  
**UI brief (Impeccable shape):** slideover da etapa + Salvar único no rodapé; builder no editor de template atual

## Objetivo

A escola monta, por etapa do template, o formulário operacional que precisa (upload de documentos, checklist, textos, datas, selects). No board, a secretaria abre um **slideover** com os campos da **etapa atual**, edita em draft e **Salva uma vez** — sem misturar formulário com histórico/avanço.

## Decisões


| Tema | Decisão |
|------|---------|
| Modelo | `process_template_stage_fields` + `process_field_values` |
| Tipos MVP | `file`, `checkbox`, `text`, `textarea`, `date`, `select` |
| Escopo de preenchimento | Só etapa atual |
| Gate de avanço | Soft por padrão; hard se `block_advance_if_incomplete` no template |
| Persistência na UI | Draft local + **um Salvar** no rodapé do slideover |
| Superfície de preenchimento | Slideover dedicado (não form no card; não misturar com timeline) |
| Detalhe do processo | Histórico + meta + ciclo; atalho “Preencher etapa” → mesmo slideover |
| Builder | Lista de campos **dentro de cada etapa** no `/process-templates` atual |
| Template | Vivo (igual etapas da fatia 1) |
| File | 1 arquivo por campo; vários docs = vários campos `file` |
| Eventos outbox | **Não** nesta fatia |
| Storage | Bucket lógico `process-docs` → R2 prefix `processes/` (fora da retenção de chat) |

## Escopo

**Inclui**
- CRUD de campos por etapa (admin)
- Flag `block_advance_if_incomplete` no template
- Leitura + Salvar em lote dos valores da etapa atual (agent+)
- Upload/remoção de arquivos no Salvar (e limpar arquivo)
- Gate soft/hard no `advance`
- Slideover de campos; badge “N pendentes” no card; aviso no diálogo Avançar
- i18n pt-BR

**Exclui**
- Preencher etapas futuras/passadas
- Autosave por campo
- Form inline no card do board
- Builder tipo Typeform / DnD avançado
- OCR, portal do aluno, tipos além dos 6
- Eventos `process.field_*` / `process.file_*`
- Tipar etapa como `kind=documentos`

## Schema

```text
process_templates
  + block_advance_if_incomplete boolean NOT NULL DEFAULT false

process_template_stage_fields
  id uuid PK
  account_id uuid NOT NULL
  stage_id uuid NOT NULL → process_template_stages ON DELETE CASCADE
  label text NOT NULL
  field_type text NOT NULL
    -- check: file | checkbox | text | textarea | date | select
  required boolean NOT NULL DEFAULT false
  position int NOT NULL
  config jsonb NOT NULL DEFAULT '{}'
    -- select: { "options": string[] } (mín. 1 opção se type=select)
    -- file:   { "accept"?: string, "max_bytes"?: number } opcional
  created_at, updated_at
  UNIQUE (stage_id, position)

process_field_values
  id uuid PK
  account_id uuid NOT NULL
  process_id uuid NOT NULL → enrollment_processes ON DELETE CASCADE
  field_id uuid NOT NULL → process_template_stage_fields ON DELETE CASCADE
  value jsonb NULL
    -- text/textarea/select/date: string JSON
    -- checkbox: boolean JSON
    -- file: null (metadados nas colunas abaixo)
  storage_path text NULL
  original_filename text NULL
  mime_type text NULL
  size_bytes int NULL
  updated_at timestamptz NOT NULL
  updated_by_user_id uuid NULL
  UNIQUE (process_id, field_id)
```

RLS: `is_account_member` read; write definição admin+; write valores agent+ (viewer não grava).

Migration: nova (ex. `055_process_stage_fields.sql`), no padrão das migrations existentes.

## Valor “completo” / missing

Campo `required` está **incomplete** quando:

| Tipo | Incomplete se |
|------|----------------|
| `text`, `textarea`, `select`, `date` | `value` null, não-string, ou string trim vazia |
| `checkbox` | `value !== true` (obrigatório exige marcado) |
| `file` | `storage_path` null/vazio |

Campos não-required nunca entram na contagem de bloqueio; podem aparecer como “vazios” só informativos.

## Storage

- Estender `LOGICAL_BUCKETS` com `process-docs`.
- R2: mesmo `R2_BUCKET_MEDIA` / `R2_PUBLIC_BASE_URL_MEDIA`, prefix `processes/`.
- Key: `processes/account-{accountId}/process-{processId}/field-{fieldId}-{ts}-{safe}.{ext}`
- `assertPathAllowed` deve aceitar esse prefixo escopado à conta (+ process id na key para auditoria).
- Não usar registry/quota/GC de chat-media.
- MIME/tamanho: defaults do storage + override opcional em `config` do campo.
- Driver `STORAGE_DRIVER=r2|supabase` como demais buckets.

## APIs


| Método | Rota | Role | Função |
|--------|------|------|--------|
| GET | `/api/process-templates/[id]/stages/[stageId]/fields` | viewer+ | Lista campos ordenados |
| PUT | `/api/process-templates/[id]/stages/[stageId]/fields` | admin+ | Substitui lista da etapa (body array tipado) |
| PATCH | `/api/process-templates/[id]` | admin+ | Inclui `block_advance_if_incomplete` (junto aos campos já existentes do PATCH) |
| GET | `/api/processes/[id]/fields` | viewer+ | Campos da **etapa atual** + valores + `required_missing[]` + contagens |
| PUT | `/api/processes/[id]/fields` | agent+ | **Salvar em lote** (ver abaixo) |
| POST | `/api/processes/[id]/advance` | agent+ | + gate soft/hard (abaixo) |

### PUT valores (Salvar)

`multipart/form-data`:

- `values`: JSON string — array `{ field_id: uuid, value: unknown | null }[]` só para tipos não-file (e file sem troca de arquivo).
- `file_<fieldId>`: arquivo novo (opcional, um por campo dirty).
- `clear_file_<fieldId>`: `"1"` para remover arquivo existente.

Regras:

1. Só aceita `field_id` pertencente à **etapa atual** do processo `active`.
2. Valida tipo/value; `select` ∈ `config.options`.
3. Transação lógica: upsert valores; put R2 dos files novos; delete R2 dos cleared; rollback de DB se R2 falhar após write parcial (best-effort delete órfão + 500).
4. Resposta: mesmo shape do GET (campos + missing atualizado).

Viewer: 403 no PUT. Processo não `active`: 409.

### Advance

Antes de avançar:

1. Carrega required da etapa atual + valores.
2. Se incomplete e `block_advance_if_incomplete`: **409** `{ error, missing: string[] /* labels */ }`.
3. Senão: avança como hoje; UI soft já mostrou aviso.

`GET /api/processes/[id]` pode incluir resumo opcional da etapa atual:  
`{ fields_total, fields_filled, fields_required_missing }` para badge no board sem segundo round-trip obrigatório (board pode usar GET fields sob demanda no open do slideover e cachear missing no card após Salvar/reload).

Validação: type guards manuais. Auth: `requireRole` / `toErrorResponse`.

## UI (Operate — brief confirmado)

### Board (`/processes`)

- Card leve: contato, meta, Avançar, ⋮.
- Clique no card → preferência: abrir **slideover de campos** se a etapa tiver campos; senão detalhe/histórico. Alternativa aceitável: clique abre detalhe e CTA primário “Preencher etapa” — **default da spec: clique no card abre slideover de campos quando `fields_total > 0`; senão abre detalhe.**
- Badge discreto: “N pendentes” se `fields_required_missing > 0`; nada (ou check muted) se completo e há campos.
- Sem inputs no card.

### Slideover de campos (`ProcessStageFieldsSheet`)

- Título: nome da etapa · nome do aluno.
- Corpo: campos na ordem `position`, controles do DS, `*` em required.
- Draft em state React até Salvar; fechar com dirty → confirm descartar (dialog curto).
- Rodapé sticky: **Salvar** (primary, loading) + Fechar/Cancelar.
- Empty: “Nenhum campo nesta etapa.”
- Erro no Salvar: toast + draft preservado.
- Viewer: read-only, sem Salvar.

### Detalhe / histórico (`ProcessDetailSheet`)

- Continua histórico, telefone/CPF, ações de ciclo.
- Atalho “Preencher etapa” reabre o slideover de campos.
- Não duplicar o formulário completo na timeline.

### Diálogo Avançar

- Soft + missing: aviso com labels + pode confirmar.
- Hard + missing: lista + confirmar desabilitado (ou hidden); copy aponta para Preencher.

### Templates (`/process-templates`)

- Em cada etapa: lista ordenável (↑↓ ou reorder simples), Adicionar campo, tipo, label, obrigatório, config (opções do select; accept/max do file).
- Switch no formulário do template: “Bloquear avanço se campos obrigatórios incompletos”.
- Sem builder drag-and-drop estilo formulário marketing.

### i18n

Só `messages/pt-BR.json` (`Processes.fields`, `Processes.templates.fields`, etc.).

## Componentes sugeridos (lib)

| Peça | Responsabilidade |
|------|------------------|
| `src/lib/processes/field-types.ts` | Union de tipos, guards, `isFieldComplete`, parse config |
| `src/lib/processes/field-values.ts` | Missing list, normalize value |
| `src/components/processes/process-stage-fields-sheet.tsx` | Slideover + draft + Salvar |
| `src/components/processes/process-field-control.tsx` | Render por `field_type` |
| `src/components/process-templates/stage-fields-editor.tsx` | Builder na etapa |

## Critérios de sucesso

- Admin cria na etapa “Documentação”: 2× `file` (RG, comprovante), 1× `checkbox`, 1× `select`.
- Agent abre slideover, preenche, Salva uma vez; badge do card atualiza.
- Soft: avança com missing + aviso. Hard: 409 + UI bloqueia confirmar.
- Arquivo em `processes/…`; delete/clear remove objeto e limpa valor.
- Etapa sem campos: slideover empty; avanço inalterado.
- `npm run typecheck` e lint nos arquivos tocados ok.

## Riscos

- Template vivo: admin remove campo → cascade apaga valores (esperado; avisar na UI do builder).
- Salvar multipart grande: limitar N files × max_bytes; toast claro.
- Clique no card: documentar no plano o default (campos vs detalhe) para não regressar o drill-down da fatia 1.

## Atualizações correlatas

- Epic: fatia 2 passa a chamar-se **Campos por etapa** (não só “Documentação”).
- Ao implementar: `PRODUCT.md` — “campos/docs no processo” de em aberto → confirmado.

## Próximo passo

Plano de implementação em `docs/superpowers/plans/2026-07-30-process-stage-fields.md` (após review humano desta spec).
