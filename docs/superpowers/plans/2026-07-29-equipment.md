# Equipamentos — Implementation Plan

> Implement task-by-task.

**Goal:** CRUD de frota (veículo/embarcação) + manutenções com sync de status e badges de alerta.

**Spec:** `docs/superpowers/specs/2026-07-29-equipment-design.md`

## Tasks

- [x] 1. Migration `048_equipment.sql` + apply
- [x] 2. `validate.ts` + `status-sync.ts` + `alerts.ts` + testes
- [x] 3. Tipos + API `/api/equipment/**`
- [x] 4. UI `/equipment` + form + manutenções
- [x] 5. i18n + sidebar/header
- [x] 6. typecheck + lint + vitest
