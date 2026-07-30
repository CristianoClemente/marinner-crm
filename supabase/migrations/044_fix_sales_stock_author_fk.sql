-- ============================================================
-- 044 — Corrige as FKs de autoria de vendas e movimentos de estoque
--
-- A migration 043 apontou `sales.sold_by` e `stock_movements.created_by`
-- para `profiles(id)`. Mas `profiles.id` é um UUID próprio da tabela — o id
-- do usuário do Supabase Auth vive em `profiles.user_id`. As rotas gravam
-- o uid do Auth (`ctx.userId`, convenção de todo o resto do schema), então
-- todo INSERT falhava com:
--   violates foreign key constraint "stock_movements_created_by_fkey"
-- o que bloqueava estoque inicial, ajuste de estoque e confirmação de venda.
--
-- Correção: apontar as duas colunas para `auth.users(id)`, igual às demais
-- colunas de autoria do projeto (api_keys.created_by, ai_knowledge.created_by,
-- webhook_endpoints.created_by…).
-- ============================================================

ALTER TABLE stock_movements
  DROP CONSTRAINT IF EXISTS stock_movements_created_by_fkey;

ALTER TABLE stock_movements
  ADD CONSTRAINT stock_movements_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE RESTRICT;

ALTER TABLE sales
  DROP CONSTRAINT IF EXISTS sales_sold_by_fkey;

ALTER TABLE sales
  ADD CONSTRAINT sales_sold_by_fkey
  FOREIGN KEY (sold_by) REFERENCES auth.users(id) ON DELETE RESTRICT;
