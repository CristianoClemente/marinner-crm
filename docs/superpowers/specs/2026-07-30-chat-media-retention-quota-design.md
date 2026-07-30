# Design: Retenção e quota de mídia de conversas (R2)

**Data:** 2026-07-30  
**Status:** aprovado (aguardando plano)  
**Abordagem:** 1 — catálogo de objetos + cron  
**Depende de:** `docs/superpowers/specs/2026-07-30-r2-storage-migration-design.md`

## Decisões

| Tema | Decisão |
|------|---------|
| Retenção padrão | **180 dias** a partir do upload |
| Pacote vende | Só **espaço (GB)** — retenção continua 180 dias |
| Quota base | **5 GB** por conta (só conversa) |
| Limite cheio | **Hard block** de novos uploads de `chat-media` |
| Escopo desta fatia | Retenção + pacotes no DB + UI uso/limite; compra **manual/admin** (sem Asaas) |
| Fora de escopo | Checkout Asaas; retenção prolongada; branding/avatars/flows na quota; inbound Meta não baixado para o R2 |

## Arquitetura

```text
Upload chat-media
  → checa uso vs quota (5 GB + pacotes active)
  → PutObject R2 (prefixo chat/)
  → insert chat_media_objects (expires_at = now + 180d)
  → { publicUrl, path, objectId }

Cron diário /api/storage/cron
  → objetos expires_at <= now AND deleted_at IS NULL
  → DeleteObject R2 → deleted_at
  → limpa messages.media_url vinculadas

Admin aplica pacote
  → account_storage_packages (extra_bytes)
  → quota efetiva sobe; UI atualiza
```

## Schema

### `chat_media_objects`

| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | uuid PK | |
| `account_id` | uuid FK → accounts | RLS |
| `r2_key` | text | key completa `chat/account-…/…` |
| `bytes` | bigint | tamanho do arquivo |
| `content_type` | text | |
| `created_at` | timestamptz | |
| `expires_at` | timestamptz | created_at + 180 dias |
| `message_id` | uuid nullable FK → messages | preenchido no send |
| `deleted_at` | timestamptz nullable | GC |

Índices: `(account_id) WHERE deleted_at IS NULL`, `(expires_at) WHERE deleted_at IS NULL`.

### `account_storage_packages`

| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | uuid PK | |
| `account_id` | uuid FK | |
| `extra_bytes` | bigint | ex. 5 GiB |
| `label` | text | “+5 GB” |
| `starts_at` | timestamptz | |
| `ends_at` | timestamptz nullable | null = sem fim |
| `status` | text | `active` \| `canceled` |
| `created_by_user_id` | uuid nullable | |
| `notes` | text nullable | compra manual |
| `created_at` | timestamptz | |

Quota efetiva = `CHAT_MEDIA_BASE_QUOTA_BYTES` (default 5 GiB) + Σ `extra_bytes` onde `status = active` e (`ends_at IS NULL` OR `ends_at > now()`).

Uso = Σ `bytes` em `chat_media_objects` com `deleted_at IS NULL`.

## APIs

| Rota | Auth | Função |
|------|------|--------|
| `POST /api/storage/upload` | já existente; gate quota se `chat-media` | bloqueia se estourar |
| `GET /api/account/storage` | member | `{ usedBytes, quotaBytes, retentionDays, packages[] }` |
| `POST /api/account/storage-packages` | admin+ | cria pacote |
| `PATCH /api/account/storage-packages/[id]` | admin+ | cancelar |
| `POST /api/storage/cron` | `x-cron-secret` | GC expirados |

Constantes (código + env opcional):  
`CHAT_MEDIA_RETENTION_DAYS=180`, `CHAT_MEDIA_BASE_QUOTA_BYTES=5368709120`.

## UI

- Settings → painel **Armazenamento**: barra uso/limite, texto de retenção 180 dias, lista de pacotes, hint para pedir upgrade.
- Admin: formulário adicionar/cancelar pacote.
- Inbox: toast se upload bloqueado por quota.

## Segurança

- RLS por `account_id`.
- Pacotes: escrita só via `requireRole('admin')`.
- Cron: secret compartilhado (`AUTOMATION_CRON_SECRET`); delete só keys do registro.
- Branding/avatars/flows **não** passam pelo gate de quota de conversa.

## Critérios de sucesso

- Upload `chat-media` respeita quota; pacote admin aumenta limite.
- Após `expires_at`, objeto some do R2 e `media_url` é limpa; texto da mensagem permanece.
- `npm run typecheck` / `lint` / testes unitários de quota passam.

## Rollout

1. Migration + libs de quota + gate no upload.  
2. Cron + limpeza de `media_url`.  
3. UI Settings + APIs de pacote.  
4. Agendar ping diário no host (mesmo secret dos outros crons).
