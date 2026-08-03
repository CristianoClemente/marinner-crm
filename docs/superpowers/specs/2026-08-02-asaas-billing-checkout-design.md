# Design: Mensalidades Marinner via Asaas Checkout

**Data:** 2026-08-02  
**Status:** implementado (MVP)

## Decisões

- Checkout hospedado Asaas (`chargeTypes: RECURRENT`)
- Meios: CREDIT_CARD, PIX, BOLETO
- Ciclo MONTHLY; trial 14 dias (`nextDueDate = hoje+14`)
- Schema: `plans` + `subscriptions` (1:1 `account_id`) + `billing_events` — sem tabela `empresas` nesta fatia
- Preços seed: Starter R$197 / Pro R$397 / Business R$797

## Fluxo

1. Owner em `/billing/checkout` escolhe plano + CPF/CNPJ + telefone + CEP/número
2. `POST /api/billing/checkout` cria customer + checkout Asaas; grava `subscriptions` `incomplete`
3. Redirect para URL do Asaas
4. Webhooks `POST /api/webhooks/asaas` (header `asaas-access-token`) atualizam status
5. Dashboard shell redireciona se `needsCheckout`

## Arquivos

- Migration: `supabase/migrations/060_billing_plans_subscriptions.sql`
- Client: `src/lib/billing/asaas.ts`
- Entitlements: `src/lib/billing/entitlements.ts`, `get-entitlements.ts`
- APIs: `src/app/api/billing/*`, `src/app/api/webhooks/asaas`
- UI: `src/app/billing/checkout`, Settings → Assinatura

## Env

`ASAAS_API_KEY`, `ASAAS_ENV`, `ASAAS_WEBHOOK_TOKEN` (+ paths de callback opcionais). Ver `.env.local.example`.

## Sandbox checklist

1. Configurar keys Asaas sandbox + webhook URL pública (ngrok) → `/api/webhooks/asaas`
2. Signup nova escola → login → gate → `/billing/checkout`
3. Completar checkout teste → webhook → status `trialing`/`active`
4. Replay do mesmo `event.id` → `duplicate: true` sem efeito duplo
