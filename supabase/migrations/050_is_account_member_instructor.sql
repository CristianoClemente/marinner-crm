-- Atualiza ranks de is_account_member para incluir instructor = 0.
-- Depende de 049 (enum value já commitado).

CREATE OR REPLACE FUNCTION is_account_member(
  target_account_id UUID,
  min_role account_role_enum DEFAULT 'viewer'
) RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.user_id = auth.uid()
      AND p.account_id = target_account_id
      AND CASE p.account_role
            WHEN 'owner' THEN 4
            WHEN 'admin' THEN 3
            WHEN 'agent' THEN 2
            WHEN 'viewer' THEN 1
            WHEN 'instructor' THEN 0
          END
        >=
          CASE min_role
            WHEN 'owner' THEN 4
            WHEN 'admin' THEN 3
            WHEN 'agent' THEN 2
            WHEN 'viewer' THEN 1
            WHEN 'instructor' THEN 0
          END
  );
$$;

ALTER FUNCTION is_account_member(UUID, account_role_enum) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION is_account_member(UUID, account_role_enum)
  TO authenticated, service_role;

COMMENT ON FUNCTION is_account_member(UUID, account_role_enum) IS
  'Membership + min role. instructor=0 (below viewer) so CRM SELECT policies exclude instructors.';
