-- Locais de aula + regras de bônus genéricas por local (Fatia 1).

CREATE TABLE IF NOT EXISTS class_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  endereco TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade TEXT,
  estado TEXT,
  cep TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive')),
  has_expense BOOLEAN NOT NULL DEFAULT false,
  expense_type TEXT
    CHECK (
      expense_type IS NULL
      OR expense_type IN ('monthly_fee', 'per_class', 'per_day', 'per_student')
    ),
  expense_amount NUMERIC(12, 2)
    CHECK (expense_amount IS NULL OR expense_amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT class_locations_expense_fields CHECK (
    (
      has_expense = false
      AND expense_type IS NULL
      AND expense_amount IS NULL
    )
    OR (
      has_expense = true
      AND expense_type IS NOT NULL
      AND expense_amount IS NOT NULL
      AND expense_amount >= 0
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_class_locations_account_name
  ON class_locations (account_id, name);

CREATE INDEX IF NOT EXISTS idx_class_locations_account_status
  ON class_locations (account_id, status);

DROP TRIGGER IF EXISTS set_updated_at ON class_locations;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON class_locations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE class_locations IS
  'Locais físicos de aula. Despesa opcional com tipo/valor condicionais.';

CREATE TABLE IF NOT EXISTS class_location_bonus_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES class_locations(id) ON DELETE CASCADE,
  bonus_type TEXT NOT NULL
    CHECK (bonus_type IN ('monthly_fee', 'per_class', 'per_day', 'per_student')),
  bonus_amount NUMERIC(12, 2) NOT NULL CHECK (bonus_amount >= 0),
  starts_on DATE NOT NULL DEFAULT CURRENT_DATE,
  ends_on DATE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT class_location_bonus_rules_dates CHECK (
    ends_on IS NULL OR ends_on >= starts_on
  )
);

CREATE INDEX IF NOT EXISTS idx_class_location_bonus_rules_lookup
  ON class_location_bonus_rules (location_id, active, starts_on DESC);

DROP TRIGGER IF EXISTS set_updated_at ON class_location_bonus_rules;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON class_location_bonus_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE class_location_bonus_rules IS
  'Regras de bônus por local (genéricas nesta fatia; instructor/course depois).';

ALTER TABLE class_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_location_bonus_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS class_locations_select ON class_locations;
DROP POLICY IF EXISTS class_locations_insert ON class_locations;
DROP POLICY IF EXISTS class_locations_update ON class_locations;
DROP POLICY IF EXISTS class_locations_delete ON class_locations;

CREATE POLICY class_locations_select ON class_locations
  FOR SELECT USING (is_account_member(account_id));
CREATE POLICY class_locations_insert ON class_locations
  FOR INSERT WITH CHECK (is_account_member(account_id, 'admin'));
CREATE POLICY class_locations_update ON class_locations
  FOR UPDATE USING (is_account_member(account_id, 'admin'));
CREATE POLICY class_locations_delete ON class_locations
  FOR DELETE USING (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS class_location_bonus_rules_select ON class_location_bonus_rules;
DROP POLICY IF EXISTS class_location_bonus_rules_insert ON class_location_bonus_rules;
DROP POLICY IF EXISTS class_location_bonus_rules_update ON class_location_bonus_rules;
DROP POLICY IF EXISTS class_location_bonus_rules_delete ON class_location_bonus_rules;

CREATE POLICY class_location_bonus_rules_select ON class_location_bonus_rules
  FOR SELECT USING (is_account_member(account_id));
CREATE POLICY class_location_bonus_rules_insert ON class_location_bonus_rules
  FOR INSERT WITH CHECK (is_account_member(account_id, 'admin'));
CREATE POLICY class_location_bonus_rules_update ON class_location_bonus_rules
  FOR UPDATE USING (is_account_member(account_id, 'admin'));
CREATE POLICY class_location_bonus_rules_delete ON class_location_bonus_rules
  FOR DELETE USING (is_account_member(account_id, 'admin'));
