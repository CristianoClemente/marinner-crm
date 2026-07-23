-- ============================================================
-- 037_contacts_dados_pessoais_cha
--
-- Amplia `contacts` com dados pessoais, endereço e CHA
-- (Carteira de Habilitação de Amador) para o CRM Marinner.
--
-- Idempotente: ADD COLUMN IF NOT EXISTS.
-- RLS existente em contacts cobre as novas colunas (mesmo
-- account_id / membership).
-- ============================================================

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS cpf TEXT,
  ADD COLUMN IF NOT EXISTS data_nascimento DATE,
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS endereco TEXT,
  ADD COLUMN IF NOT EXISTS numero TEXT,
  ADD COLUMN IF NOT EXISTS bairro TEXT,
  ADD COLUMN IF NOT EXISTS cidade TEXT,
  ADD COLUMN IF NOT EXISTS estado TEXT,
  ADD COLUMN IF NOT EXISTS complemento TEXT,
  ADD COLUMN IF NOT EXISTS cep TEXT,
  ADD COLUMN IF NOT EXISTS possui_cha BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS numero_cha TEXT,
  ADD COLUMN IF NOT EXISTS categoria_cha TEXT,
  ADD COLUMN IF NOT EXISTS vencimento_cha DATE,
  ADD COLUMN IF NOT EXISTS doc_numero TEXT,
  ADD COLUMN IF NOT EXISTS doc_orgao_emissor TEXT,
  ADD COLUMN IF NOT EXISTS doc_data_emissao DATE,
  ADD COLUMN IF NOT EXISTS profissao TEXT,
  ADD COLUMN IF NOT EXISTS genero TEXT;

-- Busca / filtros comunsentes (cidade, UF, status, CPF)
CREATE INDEX IF NOT EXISTS idx_contacts_cidade
  ON contacts (account_id, cidade)
  WHERE cidade IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_estado
  ON contacts (account_id, estado)
  WHERE estado IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_status
  ON contacts (account_id, status)
  WHERE status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_cpf
  ON contacts (account_id, cpf)
  WHERE cpf IS NOT NULL;
