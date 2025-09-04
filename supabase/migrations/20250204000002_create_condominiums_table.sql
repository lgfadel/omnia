-- Criar tabela omnia_condominiums
CREATE TABLE omnia_condominiums (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  cnpj TEXT UNIQUE,
  address TEXT,
  phone TEXT,
  whatsapp TEXT,
  syndic_name TEXT,
  manager_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Habilitar RLS
ALTER TABLE omnia_condominiums ENABLE ROW LEVEL SECURITY;

-- Política para SELECT: usuários autenticados podem ver todos os condomínios
CREATE POLICY "Users can view condominiums" ON omnia_condominiums
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Política para INSERT: apenas admins podem criar condomínios
CREATE POLICY "Only admins can create condominiums" ON omnia_condominiums
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM omnia_users 
      WHERE auth_user_id = auth.uid() 
      AND 'ADMIN'::text = ANY (roles)
    )
  );

-- Política para UPDATE: apenas admins podem editar condomínios
CREATE POLICY "Only admins can update condominiums" ON omnia_condominiums
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM omnia_users 
      WHERE auth_user_id = auth.uid() 
      AND 'ADMIN'::text = ANY (roles)
    )
  );

-- Política para DELETE: apenas admins podem deletar condomínios
CREATE POLICY "Only admins can delete condominiums" ON omnia_condominiums
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM omnia_users 
      WHERE auth_user_id = auth.uid() 
      AND 'ADMIN'::text = ANY (roles)
    )
  );

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_omnia_condominiums_updated_at
  BEFORE UPDATE ON omnia_condominiums
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Adicionar campo condominium_id na tabela omnia_atas
ALTER TABLE omnia_atas ADD COLUMN condominium_id UUID REFERENCES omnia_condominiums(id);

-- Criar índices para melhor performance
CREATE INDEX idx_omnia_condominiums_cnpj ON omnia_condominiums(cnpj);
CREATE INDEX idx_omnia_atas_condominium_id ON omnia_atas(condominium_id);