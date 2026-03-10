-- Migration: Restructure condominium address fields
-- Break down the single 'address' field into structured components
-- Add support for CEP-based address lookup

-- Add new structured address fields
ALTER TABLE omnia_condominiums
  ADD COLUMN street TEXT,
  ADD COLUMN number TEXT,
  ADD COLUMN complement TEXT,
  ADD COLUMN zip_code TEXT,
  ADD COLUMN city TEXT,
  ADD COLUMN state TEXT;

-- Add check constraint for state (must be 2 characters)
ALTER TABLE omnia_condominiums
  ADD CONSTRAINT omnia_condominiums_state_length CHECK (state IS NULL OR length(state) = 2);

-- Add check constraint for zip_code format (8 digits)
ALTER TABLE omnia_condominiums
  ADD CONSTRAINT omnia_condominiums_zip_code_format CHECK (zip_code IS NULL OR zip_code ~ '^\d{8}$');

-- Create index on zip_code for performance
CREATE INDEX idx_omnia_condominiums_zip_code ON omnia_condominiums(zip_code);

-- Add comments to document the fields
COMMENT ON COLUMN omnia_condominiums.street IS 'Nome da rua/avenida';
COMMENT ON COLUMN omnia_condominiums.number IS 'Número do endereço';
COMMENT ON COLUMN omnia_condominiums.complement IS 'Complemento do endereço (apartamento, bloco, etc)';
COMMENT ON COLUMN omnia_condominiums.zip_code IS 'CEP (8 dígitos numéricos)';
COMMENT ON COLUMN omnia_condominiums.city IS 'Cidade';
COMMENT ON COLUMN omnia_condominiums.state IS 'Estado (sigla de 2 caracteres)';
COMMENT ON COLUMN omnia_condominiums.address IS 'Campo legado - será removido em migração futura';
