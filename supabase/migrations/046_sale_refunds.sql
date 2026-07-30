-- ============================================================
-- 046 — Estorno total/parcial de vendas (PDV Fatia 2)
-- ============================================================

-- 1. Status na venda
ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS status TEXT;

UPDATE sales SET status = 'confirmed' WHERE status IS NULL;

ALTER TABLE sales
  ALTER COLUMN status SET DEFAULT 'confirmed',
  ALTER COLUMN status SET NOT NULL;

ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_status_check;
ALTER TABLE sales
  ADD CONSTRAINT sales_status_check
  CHECK (status IN ('confirmed', 'partially_refunded', 'cancelled'));

CREATE INDEX IF NOT EXISTS idx_sales_account_status
  ON sales (account_id, status);

-- Agent+ pode atualizar status após estorno
DROP POLICY IF EXISTS sales_update ON sales;
CREATE POLICY sales_update ON sales
  FOR UPDATE USING (is_account_member(account_id, 'agent'));

-- 2. sale_refunds
CREATE TABLE IF NOT EXISTS sale_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
  refunded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  note TEXT NULL,
  subtotal_refunded NUMERIC(12, 2) NOT NULL CHECK (subtotal_refunded >= 0),
  discount_refunded NUMERIC(12, 2) NOT NULL CHECK (discount_refunded >= 0),
  total_refunded NUMERIC(12, 2) NOT NULL CHECK (total_refunded >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT sale_refunds_discount_lte_subtotal
    CHECK (discount_refunded <= subtotal_refunded)
);

CREATE INDEX IF NOT EXISTS idx_sale_refunds_account_created
  ON sale_refunds (account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sale_refunds_sale
  ON sale_refunds (sale_id);

COMMENT ON TABLE sale_refunds IS
  'Estornos (total ou parcial) de vendas do PDV.';

-- 3. sale_refund_items
CREATE TABLE IF NOT EXISTS sale_refund_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_id UUID NOT NULL REFERENCES sale_refunds(id) ON DELETE CASCADE,
  sale_item_id UUID NOT NULL REFERENCES sale_items(id) ON DELETE RESTRICT,
  catalog_item_id UUID NOT NULL REFERENCES catalog_items(id) ON DELETE RESTRICT,
  qty NUMERIC(12, 3) NOT NULL CHECK (qty > 0),
  unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
  line_total NUMERIC(12, 2) NOT NULL CHECK (line_total >= 0)
);

CREATE INDEX IF NOT EXISTS idx_sale_refund_items_refund
  ON sale_refund_items (refund_id);

CREATE INDEX IF NOT EXISTS idx_sale_refund_items_sale_item
  ON sale_refund_items (sale_item_id);

-- 4. stock_movements: reason sale_refund + refund_id
ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS refund_id UUID NULL
    REFERENCES sale_refunds(id) ON DELETE SET NULL;

-- Nome do CHECK inline de 043: Postgres gera stock_movements_reason_check
ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_reason_check;
ALTER TABLE stock_movements
  ADD CONSTRAINT stock_movements_reason_check
  CHECK (
    reason IN (
      'sale',
      'adjustment_in',
      'adjustment_out',
      'correction',
      'initial',
      'sale_refund'
    )
  );

CREATE INDEX IF NOT EXISTS idx_stock_movements_refund
  ON stock_movements (refund_id)
  WHERE refund_id IS NOT NULL;

-- 5. RLS
ALTER TABLE sale_refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_refund_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sale_refunds_select ON sale_refunds;
DROP POLICY IF EXISTS sale_refunds_insert ON sale_refunds;
CREATE POLICY sale_refunds_select ON sale_refunds
  FOR SELECT USING (is_account_member(account_id));
CREATE POLICY sale_refunds_insert ON sale_refunds
  FOR INSERT WITH CHECK (is_account_member(account_id, 'agent'));

DROP POLICY IF EXISTS sale_refund_items_select ON sale_refund_items;
DROP POLICY IF EXISTS sale_refund_items_insert ON sale_refund_items;
CREATE POLICY sale_refund_items_select ON sale_refund_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sale_refunds r
      WHERE r.id = sale_refund_items.refund_id
        AND is_account_member(r.account_id)
    )
  );
CREATE POLICY sale_refund_items_insert ON sale_refund_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM sale_refunds r
      WHERE r.id = sale_refund_items.refund_id
        AND is_account_member(r.account_id, 'agent')
    )
  );
