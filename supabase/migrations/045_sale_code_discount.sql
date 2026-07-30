-- ============================================================
-- 045 — Código sequencial de venda + desconto no carrinho
--
-- - account_sale_counters: próximo número por conta
-- - sales: code, subtotal, discount_type/value/amount
-- - backfill de vendas existentes
-- - RPC allocate_sale_code (atômico)
-- ============================================================

-- 1. Contador por conta
CREATE TABLE IF NOT EXISTS account_sale_counters (
  account_id UUID PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  next_code INTEGER NOT NULL DEFAULT 1 CHECK (next_code >= 1)
);

ALTER TABLE account_sale_counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS account_sale_counters_select ON account_sale_counters;
CREATE POLICY account_sale_counters_select ON account_sale_counters
  FOR SELECT USING (is_account_member(account_id));

-- Mutação só via RPC SECURITY DEFINER (sem INSERT/UPDATE direto do client).

-- 2. Colunas novas (nullable até o backfill)
ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS code TEXT,
  ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS discount_type TEXT,
  ADD COLUMN IF NOT EXISTS discount_value NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12, 2);

-- 3. Backfill: código sequencial por conta (ordem de criação)
DO $$
DECLARE
  r RECORD;
  s RECORD;
  n INTEGER;
BEGIN
  FOR r IN SELECT DISTINCT account_id FROM sales LOOP
    n := 0;
    FOR s IN
      SELECT id FROM sales
      WHERE account_id = r.account_id
      ORDER BY created_at ASC, id ASC
    LOOP
      n := n + 1;
      UPDATE sales
      SET
        code = n::text,
        subtotal = COALESCE(subtotal, total),
        discount_type = COALESCE(discount_type, 'none'),
        discount_value = COALESCE(discount_value, 0),
        discount_amount = COALESCE(discount_amount, 0)
      WHERE id = s.id;
    END LOOP;

    INSERT INTO account_sale_counters (account_id, next_code)
    VALUES (r.account_id, n + 1)
    ON CONFLICT (account_id) DO UPDATE
      SET next_code = GREATEST(account_sale_counters.next_code, EXCLUDED.next_code);
  END LOOP;

  -- Contas sem vendas ainda não precisam de linha; a RPC cria sob demanda.
  -- Vendas sem code (nenhuma, após o loop) — garantir defaults em linhas órfãs:
  UPDATE sales
  SET
    subtotal = COALESCE(subtotal, total),
    discount_type = COALESCE(discount_type, 'none'),
    discount_value = COALESCE(discount_value, 0),
    discount_amount = COALESCE(discount_amount, 0)
  WHERE subtotal IS NULL
     OR discount_type IS NULL
     OR discount_value IS NULL
     OR discount_amount IS NULL;
END $$;

-- 4. Constraints e NOT NULL
UPDATE sales SET code = id::text WHERE code IS NULL;

ALTER TABLE sales
  ALTER COLUMN code SET NOT NULL,
  ALTER COLUMN subtotal SET NOT NULL,
  ALTER COLUMN discount_type SET NOT NULL,
  ALTER COLUMN discount_type SET DEFAULT 'none',
  ALTER COLUMN discount_value SET NOT NULL,
  ALTER COLUMN discount_value SET DEFAULT 0,
  ALTER COLUMN discount_amount SET NOT NULL,
  ALTER COLUMN discount_amount SET DEFAULT 0;

ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_discount_type_check;
ALTER TABLE sales
  ADD CONSTRAINT sales_discount_type_check
  CHECK (discount_type IN ('none', 'fixed', 'percent'));

ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_discount_value_check;
ALTER TABLE sales
  ADD CONSTRAINT sales_discount_value_check
  CHECK (discount_value >= 0);

ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_discount_amount_check;
ALTER TABLE sales
  ADD CONSTRAINT sales_discount_amount_check
  CHECK (discount_amount >= 0 AND discount_amount <= subtotal);

ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_subtotal_check;
ALTER TABLE sales
  ADD CONSTRAINT sales_subtotal_check
  CHECK (subtotal >= 0);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_account_code
  ON sales (account_id, code);

COMMENT ON COLUMN sales.code IS
  'Número sequencial da venda na conta (texto do inteiro; UI faz zero-pad).';
COMMENT ON COLUMN sales.subtotal IS
  'Soma das linhas antes do desconto do carrinho.';
COMMENT ON COLUMN sales.discount_amount IS
  'Desconto efetivo em R$; total = subtotal - discount_amount (validado na API).';

-- 5. Aloca próximo código atomicamente
CREATE OR REPLACE FUNCTION allocate_sale_code(p_account_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code INTEGER;
BEGIN
  IF NOT is_account_member(p_account_id, 'agent') THEN
    RAISE EXCEPTION 'Sem permissão para registrar venda nesta conta';
  END IF;

  INSERT INTO account_sale_counters (account_id, next_code)
  VALUES (p_account_id, 1)
  ON CONFLICT (account_id) DO NOTHING;

  UPDATE account_sale_counters
  SET next_code = next_code + 1
  WHERE account_id = p_account_id
  RETURNING next_code - 1 INTO v_code;

  IF v_code IS NULL THEN
    RAISE EXCEPTION 'Falha ao alocar código de venda';
  END IF;

  RETURN v_code::text;
END;
$$;

REVOKE ALL ON FUNCTION allocate_sale_code(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION allocate_sale_code(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION allocate_sale_code(UUID) TO service_role;
