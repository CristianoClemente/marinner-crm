-- Equipamentos (frota) + manutenções (Fatia 1).

CREATE TABLE IF NOT EXISTS equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('vehicle', 'vessel')),
  subtype TEXT NOT NULL,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  engine_cycle TEXT CHECK (engine_cycle IS NULL OR engine_cycle IN ('2t', '4t')),
  fuel TEXT NOT NULL
    CHECK (fuel IN ('gasoline', 'ethanol', 'flex', 'diesel', 'electric')),
  meter_value NUMERIC(12, 1) NOT NULL DEFAULT 0 CHECK (meter_value >= 0),
  meter_unit TEXT NOT NULL CHECK (meter_unit IN ('km', 'hours')),
  document_expires_on DATE NOT NULL,
  plate_or_registration TEXT NOT NULL,
  dpem_expires_on DATE,
  dpem_protocol TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'in_maintenance', 'inactive', 'decommissioned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT equipment_subtype_kind CHECK (
    (kind = 'vehicle' AND subtype IN ('car', 'motorcycle'))
    OR (kind = 'vessel' AND subtype IN ('jet_ski', 'boat'))
  ),
  CONSTRAINT equipment_meter_unit_kind CHECK (
    (kind = 'vehicle' AND meter_unit = 'km')
    OR (kind = 'vessel' AND meter_unit = 'hours')
  ),
  CONSTRAINT equipment_dpem_kind CHECK (
    (
      kind = 'vehicle'
      AND dpem_expires_on IS NULL
      AND dpem_protocol IS NULL
    )
    OR (
      kind = 'vessel'
      AND dpem_expires_on IS NOT NULL
      AND dpem_protocol IS NOT NULL
      AND length(trim(dpem_protocol)) > 0
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_equipment_account_name
  ON equipment (account_id, name);
CREATE INDEX IF NOT EXISTS idx_equipment_account_status
  ON equipment (account_id, status);
CREATE INDEX IF NOT EXISTS idx_equipment_account_kind
  ON equipment (account_id, kind);

DROP TRIGGER IF EXISTS set_updated_at ON equipment;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON equipment
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE equipment IS
  'Frota: veículos e embarcações. DPEM obrigatório só para vessel.';

CREATE TABLE IF NOT EXISTS equipment_maintenances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('preventive', 'corrective')),
  performed_on DATE NOT NULL,
  description TEXT NOT NULL,
  meter_value_at NUMERIC(12, 1) CHECK (meter_value_at IS NULL OR meter_value_at >= 0),
  cost NUMERIC(12, 2) CHECK (cost IS NULL OR cost >= 0),
  vendor TEXT,
  next_due_on DATE,
  status TEXT NOT NULL
    CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_equipment_maintenances_equipment
  ON equipment_maintenances (equipment_id, performed_on DESC);
CREATE INDEX IF NOT EXISTS idx_equipment_maintenances_status
  ON equipment_maintenances (account_id, status);
CREATE INDEX IF NOT EXISTS idx_equipment_maintenances_next_due
  ON equipment_maintenances (account_id, next_due_on);

DROP TRIGGER IF EXISTS set_updated_at ON equipment_maintenances;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON equipment_maintenances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE equipment_maintenances IS
  'Manutenções da frota. Sync de status do equipamento na API.';

ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_maintenances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS equipment_select ON equipment;
DROP POLICY IF EXISTS equipment_insert ON equipment;
DROP POLICY IF EXISTS equipment_update ON equipment;
DROP POLICY IF EXISTS equipment_delete ON equipment;

CREATE POLICY equipment_select ON equipment
  FOR SELECT USING (is_account_member(account_id));
CREATE POLICY equipment_insert ON equipment
  FOR INSERT WITH CHECK (is_account_member(account_id, 'admin'));
CREATE POLICY equipment_update ON equipment
  FOR UPDATE USING (is_account_member(account_id, 'admin'));
CREATE POLICY equipment_delete ON equipment
  FOR DELETE USING (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS equipment_maintenances_select ON equipment_maintenances;
DROP POLICY IF EXISTS equipment_maintenances_insert ON equipment_maintenances;
DROP POLICY IF EXISTS equipment_maintenances_update ON equipment_maintenances;
DROP POLICY IF EXISTS equipment_maintenances_delete ON equipment_maintenances;

CREATE POLICY equipment_maintenances_select ON equipment_maintenances
  FOR SELECT USING (is_account_member(account_id));
CREATE POLICY equipment_maintenances_insert ON equipment_maintenances
  FOR INSERT WITH CHECK (is_account_member(account_id, 'admin'));
CREATE POLICY equipment_maintenances_update ON equipment_maintenances
  FOR UPDATE USING (is_account_member(account_id, 'admin'));
CREATE POLICY equipment_maintenances_delete ON equipment_maintenances
  FOR DELETE USING (is_account_member(account_id, 'admin'));
