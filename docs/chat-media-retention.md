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

## Agendar o cron (passo a passo)

O endpoint **não roda sozinho**. Algo externo precisa chamar a URL 1×/dia com o secret.

Endpoints que usam o **mesmo** `AUTOMATION_CRON_SECRET`:

| Rota | Função |
|------|--------|
| `/api/automations/cron` | Retoma waits de automações |
| `/api/flows/cron` | Limpa runs de flow travados |
| `/api/storage/cron` | Apaga mídia de conversa expirada (180d) |

**MCP:** não há MCP da Hostinger. Dá para agendar via **Cloudflare Workers Cron Trigger** (MCP Cloudflare) ou cron do painel / GitHub Actions (abaixo).

---

### 1. Criar o secret (uma vez)

No servidor **e** no `.env.local`:

```bash
# PowerShell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Cole no `.env.local` e no painel do host (produção):

```env
AUTOMATION_CRON_SECRET=<cole-o-hex-aqui>
```

Reinicie o app depois de salvar. **Não** cole o valor no chat.

---

### 2. Confirmar a URL pública do app

Use a URL de produção (não `localhost`), ex.:

```text
https://app.marinner.com.br/api/storage/cron
```

(Teste local só com `curl` no seu PC apontando para `http://localhost:3000`.)

---

### 3. Teste manual (antes de agendar)

```bash
curl -i -X POST "https://SEU_DOMINIO/api/storage/cron" ^
  -H "x-cron-secret: SEU_SECRET"
```

Respostas esperadas:

| Status | Significado |
|--------|-------------|
| `200` + `{ "ok": true, "scanned": … }` | OK |
| `401` | Secret errado |
| `503` | `AUTOMATION_CRON_SECRET` não está no env do servidor |

Sugestão: no mesmo script, pingue também automations e flows:

```bash
curl -s -X POST "https://SEU_DOMINIO/api/automations/cron" -H "x-cron-secret: SEU_SECRET"
curl -s -X POST "https://SEU_DOMINIO/api/flows/cron" -H "x-cron-secret: SEU_SECRET"
curl -s -X POST "https://SEU_DOMINIO/api/storage/cron" -H "x-cron-secret: SEU_SECRET"
```

---

### 4A — Hostinger (painel do site) — recomendado se o app já está lá

1. hPanel → seu site / Websites → **Cron Jobs** (ou Advanced → Cron Jobs).
2. **Common Settings** / schedule: `0 3 * * *` (todo dia 03:00 — fuso do servidor; ajuste se for UTC/BRT).
3. Command (Linux):

```bash
curl -s -X POST "https://SEU_DOMINIO/api/storage/cron" -H "x-cron-secret: SEU_SECRET"
```

Ou os três endpoints numa linha:

```bash
S=SEU_SECRET; B=https://SEU_DOMINIO; curl -s -X POST "$B/api/automations/cron" -H "x-cron-secret: $S"; curl -s -X POST "$B/api/flows/cron" -H "x-cron-secret: $S"; curl -s -X POST "$B/api/storage/cron" -H "x-cron-secret: $S"
```

4. Salve. No dia seguinte confira o log do cron / resposta 200.

> Em alguns planos Hostinger o comando usa o caminho completo do `curl` (`/usr/bin/curl`). Se falhar, use esse path.

---

### 4B — Cloudflare Worker + Cron Trigger (via MCP / Dashboard)

Útil se o domínio já está na Cloudflare e você quer o agendador fora da Hostinger.

1. Crie um Worker (Dashboard → Workers & Pages → Create) **ou** peça ao agente com MCP Cloudflare para criar o script.
2. Código mínimo do Worker:

```js
export default {
  async scheduled(event, env, ctx) {
    const base = env.APP_BASE_URL.replace(/\/+$/, "");
    const headers = { "x-cron-secret": env.CRON_SECRET };
    for (const path of [
      "/api/automations/cron",
      "/api/flows/cron",
      "/api/storage/cron",
    ]) {
      await fetch(`${base}${path}`, { method: "POST", headers });
    }
  },
};
```

3. Variables / Secrets do Worker:
   - `APP_BASE_URL` = `https://app.seudominio.com`
   - `CRON_SECRET` = mesmo valor de `AUTOMATION_CRON_SECRET`
4. Triggers → **Add Cron Trigger** → `0 6 * * *` (06:00 UTC ≈ 03:00 BRT).
5. Deploy. Em Workers → Logs, confira a execução.

Com MCP Cloudflare o agente pode listar/atualizar schedules em  
`/accounts/{id}/workers/scripts/{name}/schedules` — mas o secret deve ir só como **Secret** do Worker (não no chat).

---

### 4C — GitHub Actions (alternativa)

`.github/workflows/storage-cron.yml`:

```yaml
name: storage-cron
on:
  schedule:
    - cron: "0 6 * * *"   # 06:00 UTC
  workflow_dispatch:
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -fsS -X POST "${{ secrets.APP_BASE_URL }}/api/storage/cron" \
            -H "x-cron-secret: ${{ secrets.AUTOMATION_CRON_SECRET }}"
```

Secrets do repo: `APP_BASE_URL`, `AUTOMATION_CRON_SECRET`.

---

### Checklist

- [ ] `AUTOMATION_CRON_SECRET` no `.env.local` e na produção  
- [ ] Teste `curl` retorna 200  
- [ ] Job diário configurado (Hostinger **ou** Worker **ou** Actions)  
- [ ] (Opcional) mesmos pings para `/api/automations/cron` e `/api/flows/cron`

O GC processa até **50** objetos por execução — se houver backlog, o próximo ping continua.

## Env opcional

```env
CHAT_MEDIA_RETENTION_DAYS=180
CHAT_MEDIA_BASE_QUOTA_BYTES=5368709120
AUTOMATION_CRON_SECRET=...
STORAGE_DRIVER=r2
```

## Migration

`supabase/migrations/053_chat_media_quota.sql` — tabelas `chat_media_objects` e `account_storage_packages` + RLS.
