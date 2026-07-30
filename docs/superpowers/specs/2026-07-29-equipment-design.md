# Design: Equipamentos — frota + manutenções (Fatia 1)

**Data:** 2026-07-29  
**Status:** implementado (código + migration 048 aplicada)  
**Abordagem:** A — CRUD de equipamentos + manutenções; sync automático de status; badges de alerta na listagem

## Decisões do produto

| Tema | Decisão |
|------|---------|
| Escopo | Frota + manutenções; **sem** sinistros, anexos, push |
| Subtipos | Enum fixo enxuto: vehicle→`car`\|`motorcycle`; vessel→`jet_ski`\|`boat` |
| Status na manutenção | **Automático** (agendada/em andamento → `in_maintenance`; concluída → `active` se estava em manutenção) |
| Permissões | Agent+ lê; Admin+ cria/edita/exclui |
| Naming DB | Inglês snake_case (`equipment`); UI pt-BR |
| Medidor | Um campo `meter_value` + `meter_unit` derivado do `kind` (`km` / `hours`) |
| DPEM | Obrigatório só para `vessel`; nulo/oculto para `vehicle` |
| Ciclo do motor | `2t`\|`4t` opcional; oculto no form se subtype=`car` |
| Alerta | Badge na listagem (≤30 dias ou vencido); sem notificação push nesta fatia |

## Problema

Escolas náuticas/autoescolas precisam controlar frota (veículos e embarcações), documentos e manutenções. Sinistros e instrutores ficam para depois; Locais de aula já existem, mas não entram nesta fatia além do futuro vínculo em sinistros.

## Arquitetura

```text
account
  └─ equipment
        └─ equipment_maintenances
```

### Migration `048_equipment.sql`

**`equipment`**

| Coluna | Tipo | Notas |
|--------|------|--------|
| `id` | uuid PK | |
| `account_id` | uuid FK accounts | |
| `name` | text NOT NULL | |
| `kind` | text NOT NULL | `vehicle` \| `vessel` |
| `subtype` | text NOT NULL | ver CHECK composto |
| `brand`, `model` | text NOT NULL | |
| `engine_cycle` | text NULL | `2t` \| `4t` |
| `fuel` | text NOT NULL | `gasoline` \| `ethanol` \| `flex` \| `diesel` \| `electric` |
| `meter_value` | NUMERIC(12,1) NOT NULL DEFAULT 0 | ≥ 0 |
| `meter_unit` | text NOT NULL | `km` \| `hours` |
| `document_expires_on` | date NOT NULL | |
| `plate_or_registration` | text NOT NULL | |
| `dpem_expires_on` | date NULL | |
| `dpem_protocol` | text NULL | |
| `status` | text NOT NULL DEFAULT `active` | `active` \| `in_maintenance` \| `inactive` \| `decommissioned` |
| `created_at` / `updated_at` | timestamptz | |

CHECKs:

- subtype × kind:  
  `(kind='vehicle' AND subtype IN ('car','motorcycle')) OR (kind='vessel' AND subtype IN ('jet_ski','boat'))`
- meter_unit × kind:  
  `(kind='vehicle' AND meter_unit='km') OR (kind='vessel' AND meter_unit='hours')`
- DPEM:  
  `(kind='vehicle' AND dpem_expires_on IS NULL AND dpem_protocol IS NULL) OR (kind='vessel' AND dpem_expires_on IS NOT NULL AND dpem_protocol IS NOT NULL AND length(trim(dpem_protocol)) > 0)`

Índices: `(account_id, name)`, `(account_id, status)`, `(account_id, kind)`.

RLS: SELECT membros; INSERT/UPDATE/DELETE `admin+` (padrão catálogo/locais).

**`equipment_maintenances`**

| Coluna | Tipo | Notas |
|--------|------|--------|
| `id` | uuid PK | |
| `account_id` | uuid FK | |
| `equipment_id` | uuid FK CASCADE | |
| `kind` | text | `preventive` \| `corrective` |
| `performed_on` | date NOT NULL | |
| `description` | text NOT NULL | |
| `meter_value_at` | NUMERIC(12,1) NULL | ≥ 0 |
| `cost` | NUMERIC(12,2) NULL | ≥ 0 |
| `vendor` | text NULL | |
| `next_due_on` | date NULL | |
| `status` | text NOT NULL | `scheduled` \| `in_progress` \| `completed` \| `cancelled` |
| `created_at` / `updated_at` | timestamptz | |

Índice: `(equipment_id, performed_on DESC)`, `(account_id, status)`, `(account_id, next_due_on)`.

### Sync de status (API, não trigger)

Ao criar/atualizar manutenção:

| Status manutenção | Efeito no equipamento |
|-------------------|------------------------|
| `scheduled` ou `in_progress` | → `in_maintenance` (se status atual ∈ {`active`,`in_maintenance`}) |
| `completed` | → `active` **somente se** status atual = `in_maintenance` |
| `cancelled` | sem mudança automática |

Não sobrescrever `inactive` / `decommissioned`.

Opcional na mesma operação: se `meter_value_at` informado e maior que o medidor atual, atualizar `equipment.meter_value`.

### Componentes

| Peça | Responsabilidade |
|------|------------------|
| Migration `048_…` | Schema + RLS |
| `src/lib/equipment/validate.ts` | Create/patch equipment + maintenance |
| `src/lib/equipment/status-sync.ts` | Regras de sync (puro) + testes |
| `src/lib/equipment/alerts.ts` | Flags doc/DPEM/next_due ≤30d ou vencido |
| `/api/equipment/**` | REST |
| `/equipment` | Listagem + form + seção manutenções |
| Tipos `@/types` | `Equipment`, `EquipmentMaintenance`, enums |
| Sidebar + Header | Após Locais de aula |
| `messages/pt-BR.json` | `Equipment.*` |

### API

| Método | Rota | Auth |
|--------|------|------|
| GET | `/api/equipment` | agent+ (`?q=`, `?status=`, `?kind=`) |
| GET | `/api/equipment/[id]` | agent+ (+ maintenances recentes) |
| POST / PATCH | `/api/equipment[…]` | admin+ |
| DELETE | `/api/equipment/[id]` | admin+ → soft (`status = inactive`) |
| GET | `/api/equipment/[id]/maintenances` | agent+ (`?status=`, `?from=`, `?to=`) |
| POST | `/api/equipment/[id]/maintenances` | admin+ (+ sync status) |
| PATCH / DELETE | `/api/equipment/[id]/maintenances/[mid]` | admin+; DELETE soft `cancelled` |

### UI

- Listagem tabela: Nome · Tipo · Placa/inscrição · Medidor · Status · badges de alerta · ações
- Busca nome/placa; filtros kind + status
- Form: kind dispara limpeza de subtype/DPEM/meter_unit; DPEM só vessel; engine_cycle oculto se car
- Edição: seção Manutenções (lista + form rápido)
- Badge alerta: documento, DPEM (vessel), próxima manutenção — vermelho se vencido, âmbar se ≤30 dias

### Testes

- Veículo rejeita DPEM preenchido; embarcação exige DPEM
- Subtype inválido para kind rejeitado
- Sync: scheduled → in_maintenance; completed → active; cancelled não mexe; inactive preservado
- Alerts: vencido / dentro de 30 dias / ok

## Fora de escopo

- Sinistros e vínculo com `class_locations` / instrutor
- Anexos (Storage)
- Notificações push / tabela `notifications`
- Subtipos configuráveis
- Import CSV

## Success criteria

1. Admin cadastra veículo sem DPEM e embarcação com DPEM
2. Manutenção em andamento coloca equipamento em manutenção; conclusão devolve a ativo
3. Listagem mostra badges de documento/manutenção próximos
4. Migration aplicada; typecheck + lint + testes do lib passam
