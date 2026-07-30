# Design: Migração Supabase Storage → Cloudflare R2

**Data:** 2026-07-30  
**Status:** aprovado (aguardando plano)  
**Abordagem:** 1 — adapter fino + rota autenticada  
**Guia ops:** `docs/cloudflare-r2-storage.md`

## Decisões

| Tema | Decisão |
|------|---------|
| Objetos antigos | Permanecem no Supabase; só **novos** uploads vão ao R2 |
| Escopo | `chat-media`, `flow-media`, `account-branding` **e** avatares (`avatars`) |
| Upload | Browser → API Marinner (`multipart`) → `PutObject` R2 (sem CORS no bucket) |
| Buckets R2 | Separados: `marinner-media` e `marinner-branding` (avatars no branding) |
| URL pública | Uma base por bucket R2 (`R2_PUBLIC_BASE_URL_MEDIA` / `_BRANDING`) |
| Driver | `STORAGE_DRIVER=r2 \| supabase` (rollback sem migrar objetos) |
| Fora de escopo | Cópia de objetos antigos; desligar buckets Supabase; custom domain obrigatório |

## Arquitetura

```text
UI (inbox / flows / branding / perfil)
  → uploadAccountMedia(logicalBucket, file)  // contrato atual
      ├─ STORAGE_DRIVER=supabase → cliente Supabase Storage
      └─ STORAGE_DRIVER=r2
            → POST /api/storage/upload
            → requireRole + accountId
            → PutObject R2
            → { publicUrl, path }

deleteAccountMedia → DELETE /api/storage/object (mesmo driver)
```

### Mapeamento lógico → R2

| Bucket lógico | Bucket R2 | Prefixo | Public base |
|---------------|-----------|---------|-------------|
| `chat-media` | `marinner-media` | `chat/` | `R2_PUBLIC_BASE_URL_MEDIA` |
| `flow-media` | `marinner-media` | `flow/` | idem |
| `account-branding` | `marinner-branding` | `branding/` | `R2_PUBLIC_BASE_URL_BRANDING` |
| `avatars` | `marinner-branding` | `avatars/` | idem |

**Key (mídia/branding):** `{prefix}account-<accountId>/<timestamp>-<safe>.<ext>`  
**Key (avatars):** `{prefix}account-<accountId>/user-<userId>/avatar-<timestamp>.<ext>`

`buildMediaPath` permanece a fonte da parte `account-…`; o prefixo lógico é aplicado no server.

## Componentes

| Peça | Responsabilidade |
|------|------------------|
| `src/lib/storage/r2.ts` | Client S3, put/delete, montagem de `publicUrl` |
| `src/lib/storage/bucket-map.ts` | Logical bucket → R2 bucket + prefix + public base |
| `src/lib/storage/upload-media.ts` | Bifurca por `STORAGE_DRIVER`; mantém exports atuais |
| `POST /api/storage/upload` | FormData `file` + `bucket`; valida tamanho/MIME; grava R2 |
| `DELETE /api/storage/object` | Body `{ bucket, path }`; path deve pertencer à conta (avatars: ao `userId`) |
| `profile-form.tsx` | Deixa de usar `supabase.storage` direto; usa `uploadAccountMedia('avatars', …)` |

Call sites de inbox/flows/branding/templates **não mudam de contrato** — só o driver por baixo.

## Auth e segurança

- Rotas usam `requireRole` / `getCurrentAccount` (`@/lib/auth/account`) + `toErrorResponse`.
- Credenciais R2 **somente** no servidor (env).
- Delete: rejeitar path fora de `account-<accountId>/` (e, em avatars, fora de `user-<userId>/`).
- Tamanhos: manter `MEDIA_MAX_BYTES` / `MEDIA_MAX_BYTES_BY_KIND` (callers + validação server-side na rota).

## Env

```env
STORAGE_DRIVER=r2
CLOUDFLARE_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
R2_REGION=auto
R2_BUCKET_MEDIA=marinner-media
R2_BUCKET_BRANDING=marinner-branding
R2_BUCKET_MEDIA_DEV=marinner-media-dev
R2_PUBLIC_BASE_URL_MEDIA=https://pub-….r2.dev
R2_PUBLIC_BASE_URL_BRANDING=https://pub-….r2.dev
```

`R2_PUBLIC_BASE_URL` (legado de um único valor) pode servir de fallback só para MEDIA; branding exige a URL dedicada.

Local: opcional usar `R2_BUCKET_MEDIA_DEV` quando `NODE_ENV=development`; senão o mesmo bucket de prod com isolamento por `account-`.

## Erros

| Caso | Resposta |
|------|----------|
| Sem sessão / role | 401 / 403 |
| Bucket lógico inválido / arquivo ausente | 400 |
| Arquivo grande demais | 413 |
| Falha R2 | 500 + log `[storage/r2]` via `console.error` |

UI continua com toast (mensagens pt-BR nos callers existentes).

## Testes

- Unit: `buildMediaPath`, `bucket-map`, guard de path no delete.
- Sem integração real com R2 no CI.
- Smoke manual: avatar, logo, anexo inbox, mídia flow, GC de draft.

## Rollout

1. Publicar URLs `r2.dev` (ou custom) nos dois buckets no env.
2. `STORAGE_DRIVER=r2` em local → smoke.
3. Produção com as mesmas envs.
4. Rollback: `STORAGE_DRIVER=supabase` (novos uploads; URLs R2 já emitidas seguem válidas).

## Critérios de sucesso

- Com `STORAGE_DRIVER=r2`, novo upload **não** grava no Supabase Storage.
- `publicUrl` abre no browser; Meta consegue fetch para WhatsApp.
- Delete de draft só remove objetos da própria conta.
- `npm run typecheck` e `npm run lint` passam.

## Riscos

- Env com uma única `R2_PUBLIC_BASE_URL` → branding/avatars quebram até existir `_BRANDING`.
- `r2.dev` menos ideal que custom domain em produção (aceitável nesta fatia).
