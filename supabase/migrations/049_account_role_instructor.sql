-- Role `instructor` (rank 0): valor no enum.
-- O helper `is_account_member` é atualizado na migration seguinte
-- (Postgres exige commit entre ADD VALUE e uso do novo label).

ALTER TYPE account_role_enum ADD VALUE IF NOT EXISTS 'instructor';
