-- Remove the legacy contacts.company column. Company/tenant data lives
-- on accounts/empresas; contact "company" was a free-text field only.
ALTER TABLE contacts DROP COLUMN IF EXISTS company;
