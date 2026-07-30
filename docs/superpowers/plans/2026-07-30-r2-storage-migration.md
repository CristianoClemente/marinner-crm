# R2 Storage Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Novos uploads (chat, flow, branding, avatars) passam pelo Cloudflare R2 via API autenticada, mantendo URLs antigas no Supabase.

**Architecture:** Client chama sempre `/api/storage/*`; o servidor escolhe driver `STORAGE_DRIVER=r2|supabase`. Mapeamento lógico → bucket R2 + prefixo + URL pública.

**Tech Stack:** Next.js 16 App Router, `@aws-sdk/client-s3`, Supabase Auth (`requireRole`), Vitest.

## Global Constraints

- Locale/mensagens de erro de API em pt-BR
- Auth só via `requireRole` / `getCurrentAccount` + `toErrorResponse`
- Zero secrets no client; path multi-tenant `account-<uuid>/…`
- Default `STORAGE_DRIVER=supabase` se unset (rollback seguro)
- Sem migração de objetos antigos

## File map

| File | Role |
|------|------|
| `src/lib/storage/bucket-map.ts` | Logical bucket → R2 config + path guards |
| `src/lib/storage/r2.ts` | S3 client put/delete/publicUrl |
| `src/lib/storage/upload-media.ts` | Client: fetch API (mantém exports) |
| `src/app/api/storage/upload/route.ts` | POST multipart |
| `src/app/api/storage/object/route.ts` | DELETE object |
| `src/components/settings/profile-form.tsx` | Usa `uploadAccountMedia('avatars')` |
| `.env.local.example` | Documentar envs |
| `docs/superpowers/specs/2026-07-30-r2-storage-migration-design.md` | Status → implementado |

---

### Task 1: bucket-map + testes

**Files:**
- Create: `src/lib/storage/bucket-map.ts`
- Create: `src/lib/storage/bucket-map.test.ts`

**Produces:**
- `LogicalBucket`, `LOGICAL_BUCKETS`, `isLogicalBucket`
- `resolveR2Target(bucket)`, `buildObjectKey(...)`, `assertPathAllowed(...)`

- [ ] **Step 1: Testes**

```ts
import { describe, expect, it } from "vitest";
import {
  assertPathAllowed,
  buildObjectKey,
  isLogicalBucket,
  resolveR2Target,
} from "./bucket-map";

describe("isLogicalBucket", () => {
  it("aceita os quatro buckets lógicos", () => {
    expect(isLogicalBucket("chat-media")).toBe(true);
    expect(isLogicalBucket("flow-media")).toBe(true);
    expect(isLogicalBucket("account-branding")).toBe(true);
    expect(isLogicalBucket("avatars")).toBe(true);
    expect(isLogicalBucket("other")).toBe(false);
  });
});

describe("buildObjectKey", () => {
  it("prefixa chat/", () => {
    const key = buildObjectKey({
      logicalBucket: "chat-media",
      accountId: "acc",
      userId: "u1",
      fileName: "a.png",
      now: 1,
    });
    expect(key).toBe("chat/account-acc/1-a.png");
  });

  it("avatars inclui userId", () => {
    const key = buildObjectKey({
      logicalBucket: "avatars",
      accountId: "acc",
      userId: "u1",
      fileName: "x.jpg",
      now: 2,
    });
    expect(key).toBe("avatars/account-acc/user-u1/avatar-2.jpg");
  });
});

describe("assertPathAllowed", () => {
  it("rejeita path de outra conta", () => {
    expect(() =>
      assertPathAllowed({
        logicalBucket: "chat-media",
        path: "chat/account-other/1-a.png",
        accountId: "acc",
        userId: "u1",
      }),
    ).toThrow();
  });

  it("exige userId em avatars", () => {
    expect(() =>
      assertPathAllowed({
        logicalBucket: "avatars",
        path: "avatars/account-acc/user-other/avatar-1.jpg",
        accountId: "acc",
        userId: "u1",
      }),
    ).toThrow();
  });
});
```

- [ ] **Step 2: Implementar `bucket-map.ts`** até os testes passarem
- [ ] **Step 3:** `npx vitest run src/lib/storage/bucket-map.test.ts`

---

### Task 2: client R2 + rotas API

**Files:**
- Create: `src/lib/storage/r2.ts`
- Create: `src/app/api/storage/upload/route.ts`
- Create: `src/app/api/storage/object/route.ts`
- Modify: `src/lib/storage/upload-media.ts`
- Modify: `src/components/settings/profile-form.tsx`
- Modify: `.env.local.example`
- Dep: `@aws-sdk/client-s3`

**Auth por bucket:** `avatars` → `instructor`; `chat-media`/`flow-media` → `agent`; `account-branding` → `admin`.

**Driver:** `process.env.STORAGE_DRIVER === 'r2'` → R2; senão Supabase Storage via `ctx.supabase` (path sem prefixo R2 para buckets lógicos iguais aos nomes Supabase; avatars → bucket `avatars`).

- [ ] **Step 1:** `npm install @aws-sdk/client-s3`
- [ ] **Step 2:** Implementar `r2.ts`, rotas, `upload-media` (fetch), profile-form
- [ ] **Step 3:** `npm run typecheck` && `npm run lint` && `npm test -- src/lib/storage`
- [ ] **Step 4:** Atualizar status da spec; commit

**Cliente `uploadAccountMedia`:** sempre `POST /api/storage/upload` (FormData `file`+`bucket`).  
**Cliente `deleteAccountMedia`:** sempre `DELETE /api/storage/object` JSON `{ bucket, path }`.

---

### Task 3: smoke checklist (humano)

- [ ] `STORAGE_DRIVER=r2` no `.env.local` (+ restart `npm run dev`)
- [ ] Avatar, logo, anexo inbox, mídia flow, delete draft
