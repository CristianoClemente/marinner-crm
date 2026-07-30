-- Instrutores: ficha + locais N:N + weekly + exceções mensais.
-- Role instructor (rank 0) não passa is_account_member(..., 'viewer');
-- policies dedicadas cobrem self-service.

CREATE TABLE IF NOT EXISTS instructors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  birth_date DATE NOT NULL,
  cha_number TEXT NOT NULL,
  cha_category TEXT NOT NULL
    CHECK (cha_category IN (
      'mta', 'ara', 'mtr', 'cpa', 'mta_ara', 'mta_mtr', 'mta_cpa'
    )),
  cha_expires_on DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive')),
  pix_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1:1 user ↔ instructor por conta (só quando vinculado).
CREATE UNIQUE INDEX IF NOT EXISTS instructors_account_user_uidx
  ON instructors (account_id, user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_instructors_account_name
  ON instructors (account_id, full_name);

CREATE INDEX IF NOT EXISTS idx_instructors_account_status
  ON instructors (account_id, status);

DROP TRIGGER IF EXISTS set_updated_at ON instructors;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON instructors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE instructors IS
  'Ficha de instrutor. Email vem de profiles via user_id. CHA vencida não bloqueia.';

CREATE TABLE IF NOT EXISTS instructor_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  instructor_id UUID NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES class_locations(id) ON DELETE CASCADE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (instructor_id, location_id)
);

CREATE INDEX IF NOT EXISTS idx_instructor_locations_location
  ON instructor_locations (location_id)
  WHERE active = true;

DROP TRIGGER IF EXISTS set_updated_at ON instructor_locations;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON instructor_locations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE instructor_locations IS
  'N:N instrutor ↔ local de aula. Admin gerencia; instructor só SELECT.';

CREATE TABLE IF NOT EXISTS instructor_weekly_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  instructor_id UUID NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  weekday SMALLINT NOT NULL CHECK (weekday >= 0 AND weekday <= 6),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (instructor_id, weekday)
);

DROP TRIGGER IF EXISTS set_updated_at ON instructor_weekly_availability;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON instructor_weekly_availability
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE instructor_weekly_availability IS
  'Padrão semanal. weekday: 0=domingo … 6=sábado.';

CREATE TABLE IF NOT EXISTS instructor_unavailability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  instructor_id UUID NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  on_date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (instructor_id, on_date)
);

CREATE INDEX IF NOT EXISTS idx_instructor_unavailability_date
  ON instructor_unavailability (instructor_id, on_date);

DROP TRIGGER IF EXISTS set_updated_at ON instructor_unavailability;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON instructor_unavailability
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE instructor_unavailability IS
  'Exceções mensais (datas em que o instrutor não está disponível).';

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE instructors ENABLE ROW LEVEL SECURITY;
ALTER TABLE instructor_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE instructor_weekly_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE instructor_unavailability ENABLE ROW LEVEL SECURITY;

-- instructors
DROP POLICY IF EXISTS instructors_select ON instructors;
DROP POLICY IF EXISTS instructors_insert ON instructors;
DROP POLICY IF EXISTS instructors_update ON instructors;
DROP POLICY IF EXISTS instructors_delete ON instructors;

CREATE POLICY instructors_select ON instructors
  FOR SELECT USING (
    is_account_member(account_id, 'admin')
    OR (
      user_id = auth.uid()
      AND is_account_member(account_id, 'instructor')
    )
  );

CREATE POLICY instructors_insert ON instructors
  FOR INSERT WITH CHECK (is_account_member(account_id, 'admin'));

CREATE POLICY instructors_update ON instructors
  FOR UPDATE USING (
    is_account_member(account_id, 'admin')
    OR (
      user_id = auth.uid()
      AND is_account_member(account_id, 'instructor')
    )
  );

CREATE POLICY instructors_delete ON instructors
  FOR DELETE USING (is_account_member(account_id, 'admin'));

-- instructor_locations (admin write; admin + own instructor read)
DROP POLICY IF EXISTS instructor_locations_select ON instructor_locations;
DROP POLICY IF EXISTS instructor_locations_insert ON instructor_locations;
DROP POLICY IF EXISTS instructor_locations_update ON instructor_locations;
DROP POLICY IF EXISTS instructor_locations_delete ON instructor_locations;

CREATE POLICY instructor_locations_select ON instructor_locations
  FOR SELECT USING (
    is_account_member(account_id, 'admin')
    OR EXISTS (
      SELECT 1 FROM instructors i
      WHERE i.id = instructor_locations.instructor_id
        AND i.user_id = auth.uid()
        AND is_account_member(i.account_id, 'instructor')
    )
  );

CREATE POLICY instructor_locations_insert ON instructor_locations
  FOR INSERT WITH CHECK (is_account_member(account_id, 'admin'));

CREATE POLICY instructor_locations_update ON instructor_locations
  FOR UPDATE USING (is_account_member(account_id, 'admin'));

CREATE POLICY instructor_locations_delete ON instructor_locations
  FOR DELETE USING (is_account_member(account_id, 'admin'));

-- weekly: admin+ ou próprio instructor
DROP POLICY IF EXISTS instructor_weekly_select ON instructor_weekly_availability;
DROP POLICY IF EXISTS instructor_weekly_insert ON instructor_weekly_availability;
DROP POLICY IF EXISTS instructor_weekly_update ON instructor_weekly_availability;
DROP POLICY IF EXISTS instructor_weekly_delete ON instructor_weekly_availability;

CREATE POLICY instructor_weekly_select ON instructor_weekly_availability
  FOR SELECT USING (
    is_account_member(account_id, 'admin')
    OR EXISTS (
      SELECT 1 FROM instructors i
      WHERE i.id = instructor_weekly_availability.instructor_id
        AND i.user_id = auth.uid()
        AND is_account_member(i.account_id, 'instructor')
    )
  );

CREATE POLICY instructor_weekly_insert ON instructor_weekly_availability
  FOR INSERT WITH CHECK (
    is_account_member(account_id, 'admin')
    OR EXISTS (
      SELECT 1 FROM instructors i
      WHERE i.id = instructor_id
        AND i.account_id = account_id
        AND i.user_id = auth.uid()
        AND is_account_member(i.account_id, 'instructor')
    )
  );

CREATE POLICY instructor_weekly_update ON instructor_weekly_availability
  FOR UPDATE USING (
    is_account_member(account_id, 'admin')
    OR EXISTS (
      SELECT 1 FROM instructors i
      WHERE i.id = instructor_weekly_availability.instructor_id
        AND i.user_id = auth.uid()
        AND is_account_member(i.account_id, 'instructor')
    )
  );

CREATE POLICY instructor_weekly_delete ON instructor_weekly_availability
  FOR DELETE USING (
    is_account_member(account_id, 'admin')
    OR EXISTS (
      SELECT 1 FROM instructors i
      WHERE i.id = instructor_weekly_availability.instructor_id
        AND i.user_id = auth.uid()
        AND is_account_member(i.account_id, 'instructor')
    )
  );

-- unavailability: admin+ ou próprio instructor
DROP POLICY IF EXISTS instructor_unavail_select ON instructor_unavailability;
DROP POLICY IF EXISTS instructor_unavail_insert ON instructor_unavailability;
DROP POLICY IF EXISTS instructor_unavail_update ON instructor_unavailability;
DROP POLICY IF EXISTS instructor_unavail_delete ON instructor_unavailability;

CREATE POLICY instructor_unavail_select ON instructor_unavailability
  FOR SELECT USING (
    is_account_member(account_id, 'admin')
    OR EXISTS (
      SELECT 1 FROM instructors i
      WHERE i.id = instructor_unavailability.instructor_id
        AND i.user_id = auth.uid()
        AND is_account_member(i.account_id, 'instructor')
    )
  );

CREATE POLICY instructor_unavail_insert ON instructor_unavailability
  FOR INSERT WITH CHECK (
    is_account_member(account_id, 'admin')
    OR EXISTS (
      SELECT 1 FROM instructors i
      WHERE i.id = instructor_id
        AND i.account_id = account_id
        AND i.user_id = auth.uid()
        AND is_account_member(i.account_id, 'instructor')
    )
  );

CREATE POLICY instructor_unavail_update ON instructor_unavailability
  FOR UPDATE USING (
    is_account_member(account_id, 'admin')
    OR EXISTS (
      SELECT 1 FROM instructors i
      WHERE i.id = instructor_unavailability.instructor_id
        AND i.user_id = auth.uid()
        AND is_account_member(i.account_id, 'instructor')
    )
  );

CREATE POLICY instructor_unavail_delete ON instructor_unavailability
  FOR DELETE USING (
    is_account_member(account_id, 'admin')
    OR EXISTS (
      SELECT 1 FROM instructors i
      WHERE i.id = instructor_unavailability.instructor_id
        AND i.user_id = auth.uid()
        AND is_account_member(i.account_id, 'instructor')
    )
  );
