<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Marinner CRM

Comunique-se e escreva código (comentários, mensagens, commits) em **pt-BR**.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript `strict` · Tailwind CSS v4 (CSS-first,
sem `tailwind.config`) · shadcn/ui estilo `base-nova` sobre `@base-ui/react` ·
Supabase (Auth + Postgres + RLS) · next-intl · Vitest.

**Não existe aqui:** Nuxt, Vue, Pinia, Zod, TanStack Query, Redux, Zustand, server
actions, codegen de tipos do Supabase. Não assuma nenhum deles.

## Convenções essenciais

- Código em `src/`; import pelo alias `@/*`. Tipos compartilhados em `@/types`.
- Arquivos em kebab-case, exports React em PascalCase.
- Auth em rota de API: `requireRole(min)` / `getCurrentAccount()` de
  `@/lib/auth/account`, com `toErrorResponse(err)` no `catch`. Nunca refaça auth manual.
- Multi-tenant é a coluna `account_id` + RLS (não subdomínio). `supabaseAdmin()` ignora
  RLS — só use após checar role e sempre filtrando por `account_id`.
- Validação de body: type guards manuais + validadores de `src/lib/**` (não há Zod).
- Zero `console.log`. `console.error` é aceito em `src/lib/**` e `src/app/api/**`
  com prefixo de contexto, ex.: `console.error('[getCurrentAccount] …', error)`.
- Estilo: `cn()` de `@/lib/utils` e tokens de tema (`bg-card`, `text-muted-foreground`),
  nunca cor crua.

Antes de concluir qualquer tarefa: `npm run typecheck` e `npm run lint` devem passar.

Regras detalhadas por tema em `.cursor/rules/`.
