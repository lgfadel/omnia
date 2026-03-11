-- Normalize CNPJ format in omnia_condominiums table
-- Remove all formatting characters (dots, slashes, dashes) from CNPJ field
-- Keep only numeric digits

UPDATE omnia_condominiums
SET cnpj = regexp_replace(cnpj, '[^0-9]', '', 'g')
WHERE cnpj IS NOT NULL;

-- Add comment to document the field format
COMMENT ON COLUMN omnia_condominiums.cnpj IS 'CNPJ stored as 14 numeric digits only (no formatting). Format in UI as needed.';
