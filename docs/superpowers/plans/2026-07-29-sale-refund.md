# Estorno de vendas no PDV — Implementation Plan

> **For agentic workers:** Execute task-by-task.

**Goal:** Estorno total/parcial de vendas com devolução de estoque e desconto proporcional.

**Architecture:** Migration 046 + `prepareRefund` + `POST /api/sales/[id]/refund` + dialog no histórico do PDV.

**Tech Stack:** Next.js 16, Supabase, Vitest, next-intl.

## Tasks

- [ ] Migration `046_sale_refunds.sql` + aplicar remoto
- [ ] `src/lib/sales/refund.ts` + testes
- [ ] API POST refund + GET detalhe enriquecido
- [ ] Tipos, i18n, UI histórico + dialog
- [ ] typecheck / lint / vitest
