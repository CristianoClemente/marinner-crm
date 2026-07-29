-- 041_default_currency_brl
-- Altera apenas o DEFAULT das colunas. Linhas existentes (USD etc.)
-- permanecem intactas — o produto passa a nascer em BRL daqui pra frente.

ALTER TABLE accounts
  ALTER COLUMN default_currency SET DEFAULT 'BRL';

ALTER TABLE deals
  ALTER COLUMN currency SET DEFAULT 'BRL';
