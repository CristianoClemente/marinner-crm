# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Equipes de **escolas náuticas** (e afins de educação náutica) que atendem leads, alunos e operação comercial pelo WhatsApp: proprietários/admins configuram a escola; agentes operam inbox, contatos e funis no dia a dia; viewers acompanham com acesso limitado.

## Product Purpose

O Marinner é o CRM e sistema de gestão da escola náutica centrado no WhatsApp: unifica atendimento, relacionamento e fluxos comerciais da escola em um workspace compartilhado (inbox, contatos, funis, broadcasts, automações e fluxos), com marca da própria escola (nome, logo, subdomínio).

Sucesso significa a equipe da escola responder e converter conversas WhatsApp sem perder o contexto do aluno/lead, com identidade white-label no ambiente da escola.

## Positioning

Não é um CRM genérico “para qualquer PME”: é **gestão de escola náutica + CRM WhatsApp** — operação de atendimento e comercial da escola no canal onde o aluno já está, com white-label por escola (`{slug}.escolanautica.app.br`) e padrão Brasil (pt-BR, BRL).

## Operating Context

- Uso diário no navegador (apex `app.escolanautica.app.br` e tenant `{slug}.escolanautica.app.br`).
- Conversas oficiais via WhatsApp Business (API Meta / provedores suportados); 1 número por conta/escola.
- Papéis: owner, admin, agent, viewer, **instructor** (domínio de aulas; sem CRM operacional); convites por link.
- Configuração de marca (nome, logo, slug) em Configurações → Aparência; tema claro/escuro e cor de destaque por dispositivo.
- Locale e moeda do produto: pt-BR e BRL.

## Capabilities and Constraints

**Confirmado no produto hoje:** inbox compartilhada, contatos/tags/import, funis/negócios, **processos operacionais** (templates + enrollment por contato + **campos configuráveis por etapa** com upload R2), **Agenda** (nav principal: turmas + lembretes/eventos com cor, integrante e anotações), broadcasts com templates Meta, automações, fluxos, assistente de IA (chave do cliente), API pública e MCP, multi-tenant por `account_id` + resolução por Host/slug, **catálogo + estoque + PDV (incl. estorno)**, **locais de aula**, **equipamentos (frota)**, **instrutores** (ficha, disponibilidade, role dedicada).

**Em evolução (SaaS):** billing Asaas, planos/trial, console de plataforma — ver docs internos de plano SaaS; não inventar preços ou claims comerciais no UI.

**Terminologia:** “escola” / “conta” / “workspace” referem-se à organização tenant; “agente” é o papel operacional na inbox; “instrutor” é login de domínio de aulas (não herda SELECT do CRM).

**Em aberto:** itens de linha no funil ligados ao catálogo; módulos acadêmicos avançados (pagamento no processo, provas/conclusão, P&L de turma, dashboard operacional) — ver epic process-oriented; não assumir como entregue até existir no código.

## Brand Commitments

- Nome do produto: **Marinner** (`APP_NAME` / `NEXT_PUBLIC_APP_NAME`).
- Logo padrão: `public/brand/marinner-logo.svg` (laranja `#ea580c`); favicon alinhado.
- Cada escola pode personalizar nome, logo e slug; no apex sem tenant, a marca Marinner permanece.
- Voice da UI: português do Brasil, direto, operacional (mensagens em `messages/pt-BR.json`).

## Evidence on Hand

- Código e UI do CRM em `src/` (dashboard autenticado, auth, settings).
- Domínio escola: catálogo/PDV (`/catalog`, `/pos`), locais (`/class-locations`), equipamentos (`/equipment`), instrutores (`/instructors`, `/my-availability`), processos (`/processes`, `/process-templates`), agenda (`/agenda` — turmas + lembretes/eventos; item de nav principal).
- Navegação: sidebar operacional (inclui Agenda) + submenus recolhíveis “Escola” (catálogo, locais, equipamentos, instrutores, templates de processo) e “Automação” (transmissões, automações, fluxos, agentes IA, admin+), filtrados por role em `src/lib/nav/nav-items.ts`.
- Logo Marinner: `public/brand/marinner-logo.svg`, `public/favicon.svg`, `src/app/icon.svg`.
- Domínio e multi-tenant: `docs/dominio-e-urls.md`, Fatia 1/2 em `docs/superpowers/`.
- Roles: `docs/roles-e-permissoes.md` (inclui `instructor` rank 0).
- Plano SaaS: `docs/plano-saas-b2b.md`, `docs/perguntas-saas-b2b.md`.
- **Não fabricar:** depoimentos, logos de clientes, números de performance ou preços não confirmados.

## Product Principles

1. **Escola primeiro** — a marca e o contexto são da escola; Marinner é a plataforma por baixo.
2. **WhatsApp como canal central** — a operação diária gira em torno da conversa, não de formulários isolados.
3. **Clareza operacional** — hierarquia e densidade para trabalhar rápido (inbox, funil, configs), sem marketing no app.
4. **Brasil nativo** — pt-BR e BRL como padrão do produto.
5. **Não inventar prova** — só conteúdo e claims que existam no repo ou forem fornecidos pela equipe.

## Accessibility & Inclusion

Sem requisito formal além de práticas já esperadas do design system (contraste razoável, foco/teclado nos controles do produto). Não há meta WCAG explícita neste momento.
