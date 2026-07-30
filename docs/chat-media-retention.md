# Mídia de conversas — retenção, quota e pacotes

**Spec:** `docs/superpowers/specs/2026-07-30-chat-media-retention-quota-design.md`  
**Plano:** `docs/superpowers/plans/2026-07-30-chat-media-retention-quota.md`  
**Storage R2:** `docs/cloudflare-r2-storage.md`

## Regras do produto

| Item | Valor |
|------|-------|
| Retenção | **180 dias** após o upload (`CHAT_MEDIA_RETENTION_DAYS`) |
| Quota base | **5 GiB** por conta (`CHAT_MEDIA_BASE_QUOTA_BYTES`) |
| Pacotes | Somam **GB extras**; retenção continua 180 dias |
| Limite cheio | Upload de `chat-media` **bloqueado** até liberar espaço ou pacote |
| Escopo | Só mídia de **conversa** (prefixo R2 `chat/`). Branding, avatares e flows não entram |

## Como funciona

1. Agente sobe anexo no inbox → `POST /api/storage/upload` (`bucket=chat-media`).
2. Servidor checa `uso + tamanho ≤ quota`; grava no R2; registra em `chat_media_objects` com `expires_at`.
3. No envio WhatsApp, `media_path` associa `message_id` ao objeto.
4. Cron diário `POST /api/storage/cron` (header `x-cron-secret` = `AUTOMATION_CRON_SECRET`) apaga expirados no R2, marca `deleted_at` e limpa `messages.media_url`.

## UI

**Configurações → Armazenamento** (`?tab=storage`):

- Barra uso / limite  
- Texto de retenção  
- Lista de pacotes  
- Admin+: formulário para adicionar/cancelar pacote (manual; Asaas depois)

## APIs

| Método | Rota | Auth |
|--------|------|------|
| GET | `/api/account/storage` | viewer+ |
| POST | `/api/account/storage-packages` | admin+ body `{ extra_gb, label?, notes?, ends_at? }` |
| PATCH | `/api/account/storage-packages/[id]` | admin+ `{ status: "canceled" }` |
| GET/POST | `/api/storage/cron` | `x-cron-secret` |

## Agendar o cron

Mesmo secret dos outros crons. Exemplo (diário 03:00 UTC):

```bash
curl -X POST "https://app.seudominio.com/api/storage/cron" \
  -H "x-cron-secret: $AUTOMATION_CRON_SECRET"
```

O GC processa até 50 objetos por execução — se houver backlog, o próximo ping continua.

## Env opcional

```env
CHAT_MEDIA_RETENTION_DAYS=180
CHAT_MEDIA_BASE_QUOTA_BYTES=5368709120
AUTOMATION_CRON_SECRET=...
STORAGE_DRIVER=r2
```

## Migration

`supabase/migrations/053_chat_media_quota.sql` — tabelas `chat_media_objects` e `account_storage_packages` + RLS.
