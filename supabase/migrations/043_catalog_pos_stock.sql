-- ============================================================
-- 043_catalog_pos_stock.sql
--
-- Catálogo unificado (produto | serviço), estoque (só produto),
-- vendas PDV + movimentos de estoque.
-- Idempotent — safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- 1. catalog_items
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS catalog_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('product', 'service')),
  name TEXT NOT NULL,
  description TEXT NULL,
  sku TEXT NULL,
  unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  stock_qty NUMERIC(12, 3) NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT catalog_items_service_zero_stock CHECK (
    kind <> 'service' OR stock_qty = 0
  ),
  CONSTRAINT catalog_items_stock_non_negative CHECK (stock_qty >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_catalog_items_account_sku
  ON catalog_items (account_id, sku)
  WHERE sku IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_catalog_items_account
  ON catalog_items (account_id);

CREATE INDEX IF NOT EXISTS idx_catalog_items_account_kind
  ON catalog_items (account_id, kind);

DROP TRIGGER IF EXISTS set_updated_at ON catalog_items;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON catalog_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE catalog_items IS
  'Catálogo da escola: produtos (com estoque) e serviços (só preço).';

-- ------------------------------------------------------------
-- 2. sales (antes de stock_movements por causa de sale_id FK)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  contact_id UUID NULL REFERENCES contacts(id) ON DELETE SET NULL,
  payment_method TEXT NOT NULL CHECK (
    payment_method IN ('cash', 'pix', 'card', 'other')
  ),
  total NUMERIC(12, 2) NOT NULL CHECK (total >= 0),
  sold_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_account_created
  ON sales (account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sales_contact
  ON sales (contact_id)
  WHERE contact_id IS NOT NULL;

COMMENT ON TABLE sales IS
  'Vendas do PDV. Contato opcional; forma de pagamento sem gateway.';

-- ------------------------------------------------------------
-- 3. sale_items
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  catalog_item_id UUID NOT NULL REFERENCES catalog_items(id),
  kind TEXT NOT NULL CHECK (kind IN ('product', 'service')),
  name TEXT NOT NULL,
  unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
  qty NUMERIC(12, 3) NOT NULL CHECK (qty > 0),
  line_total NUMERIC(12, 2) NOT NULL CHECK (line_total >= 0)
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale
  ON sale_items (sale_id);

CREATE INDEX IF NOT EXISTS idx_sale_items_catalog_item
  ON sale_items (catalog_item_id);

COMMENT ON TABLE sale_items IS
  'Linhas da venda com snapshot de nome/preço/kind.';

-- ------------------------------------------------------------
-- 4. stock_movements + trigger de saldo
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  catalog_item_id UUID NOT NULL REFERENCES catalog_items(id) ON DELETE RESTRICT,
  qty NUMERIC(12, 3) NOT NULL CHECK (qty <> 0),
  reason TEXT NOT NULL CHECK (
    reason IN (
      'sale',
      'adjustment_in',
      'adjustment_out',
      'correction',
      'initial'
    )
  ),
  note TEXT NULL,
  sale_id UUID NULL REFERENCES sales(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_item_created
  ON stock_movements (catalog_item_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stock_movements_account
  ON stock_movements (account_id);

CREATE INDEX IF NOT EXISTS idx_stock_movements_sale
  ON stock_movements (sale_id)
  WHERE sale_id IS NOT NULL;

COMMENT ON TABLE stock_movements IS
  'Ledger de estoque. Saldo em catalog_items.stock_qty atualizado por trigger.';

CREATE OR REPLACE FUNCTION apply_stock_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item_kind TEXT;
  item_account UUID;
  current_qty NUMERIC(12, 3);
  next_qty NUMERIC(12, 3);
BEGIN
  SELECT kind, account_id, stock_qty
    INTO item_kind, item_account, current_qty
  FROM catalog_items
  WHERE id = NEW.catalog_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'item de catálogo não encontrado';
  END IF;

  IF item_account IS DISTINCT FROM NEW.account_id THEN
    RAISE EXCEPTION 'account_id do movimento não confere com o item';
  END IF;

  IF item_kind IS DISTINCT FROM 'product' THEN
    RAISE EXCEPTION 'estoque só é permitido para produtos';
  END IF;

  next_qty := current_qty + NEW.qty;
  IF next_qty < 0 THEN
    RAISE EXCEPTION 'estoque insuficiente';
  END IF;

  UPDATE catalog_items
  SET stock_qty = next_qty
  WHERE id = NEW.catalog_item_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_stock_movement ON stock_movements;
CREATE TRIGGER trg_apply_stock_movement
  AFTER INSERT ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION apply_stock_movement();

-- ------------------------------------------------------------
-- 5. RLS
-- ------------------------------------------------------------
ALTER TABLE catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS catalog_items_select ON catalog_items;
DROP POLICY IF EXISTS catalog_items_insert ON catalog_items;
DROP POLICY IF EXISTS catalog_items_update ON catalog_items;
DROP POLICY IF EXISTS catalog_items_delete ON catalog_items;

CREATE POLICY catalog_items_select ON catalog_items
  FOR SELECT USING (is_account_member(account_id));
CREATE POLICY catalog_items_insert ON catalog_items
  FOR INSERT WITH CHECK (is_account_member(account_id, 'admin'));
CREATE POLICY catalog_items_update ON catalog_items
  FOR UPDATE USING (is_account_member(account_id, 'admin'));
CREATE POLICY catalog_items_delete ON catalog_items
  FOR DELETE USING (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS sales_select ON sales;
DROP POLICY IF EXISTS sales_insert ON sales;

CREATE POLICY sales_select ON sales
  FOR SELECT USING (is_account_member(account_id));
CREATE POLICY sales_insert ON sales
  FOR INSERT WITH CHECK (is_account_member(account_id, 'agent'));

DROP POLICY IF EXISTS sale_items_select ON sale_items;
DROP POLICY IF EXISTS sale_items_insert ON sale_items;

CREATE POLICY sale_items_select ON sale_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sales s
      WHERE s.id = sale_items.sale_id
        AND is_account_member(s.account_id)
    )
  );
CREATE POLICY sale_items_insert ON sale_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales s
      WHERE s.id = sale_items.sale_id
        AND is_account_member(s.account_id, 'agent')
    )
  );

DROP POLICY IF EXISTS stock_movements_select ON stock_movements;
DROP POLICY IF EXISTS stock_movements_insert ON stock_movements;
DROP POLICY IF EXISTS stock_movements_delete ON stock_movements;

CREATE POLICY stock_movements_select ON stock_movements
  FOR SELECT USING (is_account_member(account_id));
-- agent+ pode inserir (venda); API restringe adjustments a admin+.
CREATE POLICY stock_movements_insert ON stock_movements
  FOR INSERT WITH CHECK (is_account_member(account_id, 'agent'));
CREATE POLICY stock_movements_delete ON stock_movements
  FOR DELETE USING (is_account_member(account_id, 'admin'));
