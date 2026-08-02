# Design: Aviso de WhatsApp fora (header + toast)

**Data:** 2026-07-31  
**Status:** implementado  
**Contexto:** falhas de envio por token ilegível / canal desconectado; usuário pediu aviso amigável para toda a conta.

## Objetivo

Qualquer membro da conta vê, de forma discreta e acionável, quando o WhatsApp da escola não está operacional — sem jargão técnico no chrome do app.

## Decisões

| Tema | Decisão |
|------|---------|
| Audiência | Toda a conta (viewer+) |
| Persistência | Ícone no header enquanto fora |
| Aviso pontual | Toast informativo **1× por sessão** (`sessionStorage`) |
| Destino | Clique / ação → `/settings?tab=whatsapp` |
| Saúde | Endpoint leve `GET /api/whatsapp/status` (decrypt + `status` no banco; **sem** ping Meta/Z-API a cada página) |
| Copy | pt-BR amigável; detalhe `ENCRYPTION_KEY` só em Settings |
| Fora | Banner global, polling agressivo, mudar banner da inbox |

## Razões de “fora”

- `no_config` — ainda não configurado  
- `token_corrupted` / `needs_reset` — token ilegível  
- `disconnected` — `whatsapp_config.status !== 'connected'`

## UI

- Header: ícone âmbar (`MessageCircleOff`) + tooltip; oculto se online ou loading  
- Toast: uma vez por sessão; omitir se pathname já é settings/whatsapp  
- i18n em `Header` / namespace curto dedicado

## Fora de escopo

Realtime de saúde, push, e-mail ao admin.
