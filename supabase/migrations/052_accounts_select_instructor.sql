-- Instrutor (rank 0) precisa ler a própria conta para getCurrentAccount /me.
-- is_account_member(id) usa default viewer → false para instructor.
-- Min 'instructor' = qualquer membro da conta (rank ≥ 0).

DROP POLICY IF EXISTS accounts_select ON accounts;
CREATE POLICY accounts_select ON accounts
  FOR SELECT USING (is_account_member(id, 'instructor'));

COMMENT ON POLICY accounts_select ON accounts IS
  'Qualquer membro da conta (incl. instructor) pode ler metadados da conta.';
