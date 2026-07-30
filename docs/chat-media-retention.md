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

## Agendar o cron na Vercel (passo a passo)

O app está na **Vercel**. O projeto já inclui `vercel.json` com um cron diário:

```json
{ "crons": [{ "path": "/api/cron/daily", "schedule": "0 6 * * *" }] }
```

`0 6 * * *` = **06:00 UTC** (≈ 03:00 BRT). Um único job cobre automations + flows + storage (limite do plano Hobby: 1 cron/dia).

### 1. Gerar o secret

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Colar nas Environment Variables da Vercel

Project → **Settings → Environment Variables** (Production + Preview se quiser):

| Name | Value |
|------|--------|
| `CRON_SECRET` | o hex gerado |
| `AUTOMATION_CRON_SECRET` | **o mesmo** hex |

A Vercel envia `Authorization: Bearer $CRON_SECRET` nos Cron Jobs.  
`AUTOMATION_CRON_SECRET` cobre curl/manual e os endpoints individuais.

Também no `.env.local` para testar local:

```env
CRON_SECRET=<mesmo>
AUTOMATION_CRON_SECRET=<mesmo>
```

### 3. Deploy

Faça deploy da branch que tem o `vercel.json` (push / Promote).  
Em **Settings → Cron Jobs** (ou Deployments → projeto) confira o job `/api/cron/daily`.

### 4. Testar

**No dashboard:** Cron Jobs → Run / aguardar próxima execução → Logs.

**Manual (produção):**

```bash
curl -i -X GET "https://SEU_PROJETO.vercel.app/api/cron/daily" ^
  -H "Authorization: Bearer SEU_SECRET"
```

Ou com o header legado:

```bash
curl -i -X POST "https://SEU_PROJETO.vercel.app/api/storage/cron" ^
  -H "x-cron-secret: SEU_SECRET"
```

| Status | Significado |
|--------|-------------|
| `200` | OK |
| `401` | Secret errado / não bate com env |
| `503` | Nenhum de `CRON_SECRET` / `AUTOMATION_CRON_SECRET` no env |

### 5. Checklist Vercel

- [ ] `CRON_SECRET` + `AUTOMATION_CRON_SECRET` iguais na Production  
- [ ] Redeploy depois de salvar env  
- [ ] `vercel.json` no deploy  
- [ ] Teste `curl` / Run now retorna 200  
- [ ] Logs do `/api/cron/daily` mostram os três `results`

### Endpoints (referência)

| Rota | Função |
|------|--------|
| `/api/cron/daily` | Orquestra os três (use este no Vercel Cron) |
| `/api/automations/cron` | Retoma waits |
| `/api/flows/cron` | Limpa runs travados |
| `/api/storage/cron` | GC mídia 180d |

> **Plano Pro:** se quiser frequência maior (ex. flows a cada hora), dá para acrescentar mais entradas em `vercel.json`. No Hobby mantenha só o daily.

---

### Alternativas (se não usar Vercel Cron)

- curl + GitHub Actions — ver histórico do doc  
- Cloudflare Worker Cron — MCP Cloudflare  

O GC de storage processa até **50** objetos por execução.

## Env opcional

```env
CHAT_MEDIA_RETENTION_DAYS=180
CHAT_MEDIA_BASE_QUOTA_BYTES=5368709120
CRON_SECRET=...
AUTOMATION_CRON_SECRET=...   # mesmo valor
STORAGE_DRIVER=r2
```

## Migration

`supabase/migrations/053_chat_media_quota.sql` — tabelas `chat_media_objects` e `account_storage_packages` + RLS.
