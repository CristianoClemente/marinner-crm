# Cloudflare R2 — guia de setup para o Marinner CRM

**Atualizado:** 2026-07-30  
**Objetivo:** configurar Object Storage na Cloudflare (R2) para substituir/complementar o Supabase Storage usado hoje (`flow-media`, `chat-media`, `account-branding`).  
**Docs oficiais:** [R2 Get started](https://developers.cloudflare.com/r2/get-started/) · [API tokens](https://developers.cloudflare.com/r2/api/tokens/) · [S3 API](https://developers.cloudflare.com/r2/api/s3/api/) · [CORS](https://developers.cloudflare.com/r2/buckets/cors/)

> **MCP:** nesta sessão do Cursor **não há** namespace Cloudflare instalado. Há MCP oficial da Cloudflare (Workers/R2/etc.) e opções community — veja a seção 9.

---

## 0. Contexto no Marinner (hoje)

Hoje o upload passa por Supabase Storage via `src/lib/storage/upload-media.ts`:

- Path: `account-<account_id>/<timestamp>-<arquivo>.<ext>`
- Buckets: `flow-media`, `chat-media`, `account-branding`
- Auth de escrita: RLS do Supabase (membership da conta)

Com R2, o padrão recomendado para Next.js App Router é:

1. **Browser → API Marinner** (auth `requireRole` / `getCurrentAccount`)
2. **API → R2** via S3 (`@aws-sdk/client-s3`) **ou** URL pré-assinada (PUT direto do browser)
3. URL pública via **custom domain** (ex.: `cdn.marinner.com.br`) ou `*.r2.dev`

**Não** coloque Access Key / Secret no client. Só no servidor (env).

---

## 1. Ativar R2 na conta Cloudflare

1. Abra o [Dashboard Cloudflare](https://dash.cloudflare.com/).
2. No menu lateral: **Storage & databases → R2 → Overview**.  
   Atalho típico: `https://dash.cloudflare.com/<ACCOUNT_ID>/r2/overview`
3. Se ainda não houver assinatura R2, complete o checkout (há faixa free mensal; billing mensal além disso — ver [Pricing](https://developers.cloudflare.com/r2/pricing/)).

### Onde achar o Account ID

| Caminho | Como |
|---------|------|
| R2 Overview | bloco **Account details** → **Account ID** |
| Qualquer página | URL: `dash.cloudflare.com/<ACCOUNT_ID>/...` |
| Sidebar | clique no nome da conta → **Account ID** (ícone de copiar) |

Guarde: `CLOUDFLARE_ACCOUNT_ID=…` (no Marinner: já preenchido em `.env.local`).

---

## 2. Criar o(s) bucket(s)

1. **R2 → Overview → Create bucket**
2. Sugestão de nomes (espelhando o produto):

| Bucket | Uso |
|--------|-----|
| `marinner-media` | chat + flows (produção) — **já criado** |
| `marinner-branding` | logos de escola — **já criado** |
| `marinner-media-dev` | ambiente local/staging — **já criado** |

3. **Location:** default (auto) ou jurisdição `EU` se precisar (endpoint muda — ver §4).
4. Crie o bucket.

---

## 3. Credenciais S3 (Access Key + Secret) — caminho detalhado

R2 **não** usa o “API Token” genérico da Cloudflare como Access Key S3. Você cria um **token R2** que gera par S3.

### Passo a passo (Dashboard)

1. Vá em **Storage & databases → R2 → Overview**.
2. Em **Account details**, ao lado de **API Tokens**, clique **Manage**.  
   URL típica: `https://dash.cloudflare.com/<ACCOUNT_ID>/r2/api-tokens`
3. Escolha:
   - **Create Account API token** — ligado à conta (recomendado para app/servidor; só Super Administrator).
   - **Create User API token** — ligado ao seu usuário (herda permissões; morre se você sair da conta).
4. **Permissions** — para o app Marinner em produção:

| Permissão | Quando usar |
|-----------|-------------|
| **Object Read & Write** | Upload + download + list (recomendado no app) |
| **Object Read only** | Só leitura (CDN/workers de leitura) |
| **Admin Read & Write** | Evitar no app — cria/apaga buckets |

5. Em **Apply to specific buckets only**, selecione só `marinner-media` / `marinner-branding` (princípio do menor privilégio).
6. **Create** → **copie imediatamente**:
   - **Access Key ID** (às vezes chamado Client ID)
   - **Secret Access Key** (às vezes Client Secret) — **não reaparece** depois

### Endpoint S3

```text
https://<ACCOUNT_ID>.r2.cloudflarestorage.com
```

Jurisdição EU:

```text
https://<ACCOUNT_ID>.eu.r2.cloudflarestorage.com
```

Região no SDK: `auto` (ou alias `us-east-1` para ferramentas teimosas).

### Token Cloudflare “geral” (outro tipo — para MCP / Wrangler / API REST)

Se for usar **Wrangler**, **MCP Cloudflare** ou API REST (criar bucket via API), você precisa de um **API Token** clássico:

1. Perfil (canto superior direito) → **My Profile → API Tokens**  
   ou **Manage Account → Account API Tokens**  
   `https://dash.cloudflare.com/profile/api-tokens`
2. **Create Token** → template **Edit Cloudflare Workers** ou custom com:
   - `Account` → `Workers R2 Storage` → **Edit** (ou Read)
   - Account Resources → include sua conta
3. Copie o token → `CLOUDFLARE_API_TOKEN=...`

Isso **não** substitui o Access Key S3 do passo anterior para `@aws-sdk/client-s3`.

---

## 4. Variáveis de ambiente (Marinner)

No `.env.local` (dev) e no host de produção (Hostinger / Vercel / etc.):

```env
# Cloudflare R2 (S3)
CLOUDFLARE_ACCOUNT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
R2_ACCESS_KEY_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
R2_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
R2_BUCKET_MEDIA=marinner-media
R2_BUCKET_BRANDING=marinner-branding
R2_ENDPOINT=https://xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.r2.cloudflarestorage.com
R2_REGION=auto

# URL pública dos objetos (escolha UMA estratégia — §5)
R2_PUBLIC_BASE_URL=https://cdn.seudominio.com
# ou, só em testes:
# R2_PUBLIC_BASE_URL=https://pub-xxxxx.r2.dev
```

Checklist de segurança:

- [ ] Nunca commit de `.env*`
- [ ] Secret só no servidor (rotas `src/app/api/**`)
- [ ] Token scoped aos buckets necessários
- [ ] Rotacionar se vazar (revogar em R2 → API Tokens)

---

## 5. Acesso público (leitura) — 3 opções

### A) Custom domain (recomendado em produção)

1. Domínio precisa estar na mesma conta Cloudflare (zona ativa).
2. No bucket: **Settings → Custom Domains → Connect Domain**  
   ex.: `cdn.marinner.com.br` ou `media.<slug>...`
3. Cloudflare cria o DNS e o HTTPS.
4. Objeto `account-<uuid>/123-foto.jpg` fica em:  
   `https://cdn.marinner.com.br/account-<uuid>/123-foto.jpg`

CLI (Wrangler), se preferir:

```bash
npx wrangler r2 bucket domain add marinner-media --domain cdn.marinner.com.br --zone-id <ZONE_ID>
```

### B) `r2.dev` subdomain (rápido para teste)

1. Bucket → **Settings → Public access → Allow Access** (r2.dev).
2. Use a URL `https://pub-….r2.dev/...`  
   Adequado a staging; em produção prefira domínio próprio.

### C) Só URLs pré-assinadas (bucket privado)

- Bucket **sem** public access.
- API gera `GetObject` / `PutObject` signed URL com TTL curto.
- Ideal para mídia sensível; WhatsApp/Meta às vezes precisa de URL estável pública para baixar mídia — valide o caso de uso.

---

## 6. CORS (obrigatório se o browser fizer PUT direto no R2)

Se o fluxo for **presigned PUT do browser → R2**:

1. Bucket → **Settings → CORS Policy**  
   ou CLI: `wrangler r2 bucket cors set <BUCKET> --file cors.json`

Exemplo `cors.json` (ajuste origins):

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3000",
      "https://app.marinner.com.br",
      "https://*.marinner.com.br"
    ],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["Content-Type", "Content-Length"],
    "ExposeHeaders": ["ETag", "Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

> Nota: wildcards em `AllowedOrigins` dependem do suporte atual do R2; se falhar, liste origins explícitas (apex + tenants conhecidos) ou faça upload **só via API Next.js** (sem CORS no R2).

**Fluxo mais simples (recomendado no Marinner):**  
browser → `POST /api/.../upload` (multipart) → servidor grava no R2. Assim **não precisa** CORS no bucket.

---

## 7. Integração sugerida no código (Next.js 16)

### 7.1 Dependências

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

### 7.2 Client server-only (`src/lib/storage/r2.ts` — esboço)

```typescript
import { S3Client } from "@aws-sdk/client-s3";

export function r2Client() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 env incompleto");
  }
  return new S3Client({
    region: process.env.R2_REGION || "auto",
    endpoint:
      process.env.R2_ENDPOINT ||
      `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}
```

### 7.3 PutObject (upload no servidor)

```typescript
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { r2Client } from "./r2";
import { buildMediaPath } from "./upload-media"; // já existe no projeto

export async function putR2Object(input: {
  bucket: string;
  accountId: string;
  fileName: string;
  body: Buffer | Uint8Array;
  contentType: string;
}) {
  const key = buildMediaPath(input.accountId, input.fileName);
  await r2Client().send(
    new PutObjectCommand({
      Bucket: input.bucket,
      Key: key,
      Body: input.body,
      ContentType: input.contentType,
      // Cache-Control opcional para CDN
    }),
  );
  const base = process.env.R2_PUBLIC_BASE_URL!.replace(/\/+$/, "");
  return { path: key, publicUrl: `${base}/${key}` };
}
```

### 7.4 Presigned PUT (opcional)

1. `POST /api/media/presign` → `{ url, key }` (auth + valida tipo/tamanho)
2. Browser `fetch(url, { method: "PUT", body: file, headers: { "Content-Type": file.type } })`
3. Persistir `publicUrl` / `key` no banco

### 7.5 Migração gradual

| Etapa | Ação |
|-------|------|
| 1 | R2 paralelo; feature flag `STORAGE_DRIVER=supabase\|r2` |
| 2 | Novos uploads em R2; leitura antiga ainda no Supabase |
| 3 | Script de cópia (S3 sync / wrangler) se precisar migrar objetos |
| 4 | Desligar buckets públicos Supabase quando estável |

Manter `buildMediaPath` para não quebrar convenção multi-tenant.

---

## 8. Checklist operacional

### Cloudflare

- [ ] R2 assinado / Overview acessível
- [ ] Account ID copiado
- [ ] Bucket(s) criados
- [ ] API Token R2 (Object Read & Write, buckets específicos)
- [ ] Access Key + Secret salvos no gerenciador de senhas / secrets do host
- [ ] Public access: custom domain **ou** r2.dev **ou** só presign
- [ ] CORS (só se upload direto do browser)

### Marinner

- [ ] Env no `.env.local` e produção
- [ ] Módulo `src/lib/storage/r2.ts` + rota de upload autenticada
- [ ] Troca de `uploadAccountMedia` ou adapter por driver
- [ ] Testar: logo branding, anexo inbox, mídia de flow
- [ ] Confirmar que Meta/WhatsApp consegue baixar URLs públicas (se aplicável)

### Teste rápido com AWS CLI

```bash
aws s3 ls s3://marinner-media \
  --endpoint-url https://<ACCOUNT_ID>.r2.cloudflarestorage.com

aws s3 cp ./teste.jpg s3://marinner-media/account-test/teste.jpg \
  --endpoint-url https://<ACCOUNT_ID>.r2.cloudflarestorage.com
```

Configure `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` com as chaves R2.

---

## 9. MCP Cloudflare no Cursor (opcional, recomendado)

Nesta workspace **ainda não** há MCP Cloudflare ativo. Para gerenciar R2/Workers pelo agente:

### Opção A — Oficial (Cloudflare)

Docs: [Cursor + Cloudflare](https://developers.cloudflare.com/agent-setup/cursor/) · [mcp-server-cloudflare](https://github.com/cloudflare/mcp-server-cloudflare)

1. Crie **API Token** Cloudflare (§3 “token geral”) com permissão R2.
2. Cursor → **Settings → Tools & MCP → Add MCP server**, ou edite `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "cloudflare": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://mcp.cloudflare.com/mcp"]
    }
  }
}
```

(Alternativa stdio / Code Mode conforme a doc atual da Cloudflare — o catálogo muda; use o “Add to Cursor” da página oficial se disponível.)

Ou com token local (varia por pacote):

```json
{
  "mcpServers": {
    "cloudflare": {
      "command": "npx",
      "args": ["-y", "@cloudflare/mcp-server-cloudflare"],
      "env": {
        "CLOUDFLARE_API_TOKEN": "cole-o-token-aqui",
        "CLOUDFLARE_ACCOUNT_ID": "cole-o-account-id"
      }
    }
  }
}
```

3. Reinicie o Cursor / recarregue MCPs.
4. Autorize OAuth se o server remoto pedir.

Com isso o agente pode listar/criar buckets, etc. **Upload de arquivo da app** continua sendo código Next.js + S3 keys.

### Opção B — Community focado em R2

Ex.: [ingsamcas/r2_mcp](https://github.com/ingsamcas/r2_mcp) — stdio com `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ENDPOINT`. Útil para o agente subir arquivos; não substitui o setup de produção.

---

## 10. Mapa rápido “onde clicar”

| O que você precisa | Caminho no Dashboard |
|--------------------|----------------------|
| Overview R2 | **Storage & databases → R2 → Overview** |
| Account ID | Overview R2 → Account details **ou** URL `dash.cloudflare.com/<id>/` |
| Criar bucket | R2 → **Create bucket** |
| Access Key / Secret S3 | R2 Overview → Account details → **API Tokens → Manage → Create** |
| CORS | Bucket → **Settings → CORS** |
| Domínio público | Bucket → **Settings → Custom Domains** |
| r2.dev público | Bucket → **Settings → Public access** |
| API Token Wrangler/MCP | Avatar → **My Profile → API Tokens** |
| Zone ID (custom domain CLI) | Domínio → **Overview** → Zone ID (coluna direita) |

---

## 11. Próximo passo no Marinner

Quando quiser **implementar** no código (não só configurar a conta):

1. Confirmar buckets + chaves + `R2_PUBLIC_BASE_URL` (me envie só os **nomes** dos buckets / domínio público — **não** cole secrets no chat).
2. Implementar `src/lib/storage/r2.ts` + adapter em `upload-media`.
3. Feature flag e smoke: branding → inbox → flows.

---

## Referências

- [Get started](https://developers.cloudflare.com/r2/get-started/)
- [S3 credentials / tokens](https://developers.cloudflare.com/r2/api/tokens/)
- [S3 API compatibility](https://developers.cloudflare.com/r2/api/s3/api/)
- [AWS SDK JS example](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js/)
- [CORS](https://developers.cloudflare.com/r2/buckets/cors/)
- [Presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)
- [Find account/zone IDs](https://developers.cloudflare.com/fundamentals/account/find-account-and-zone-ids/)
- [Cloudflare MCP](https://github.com/cloudflare/mcp-server-cloudflare)
- [Cursor agent setup](https://developers.cloudflare.com/agent-setup/cursor/)
