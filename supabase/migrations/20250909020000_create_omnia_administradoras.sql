-- Criação da tabela omnia_administradoras
CREATE TABLE omnia_administradoras (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar índices para otimização de consultas
CREATE INDEX idx_omnia_administradoras_nome ON omnia_administradoras(nome);
CREATE INDEX idx_omnia_administradoras_ativo ON omnia_administradoras(ativo);

-- Habilitar RLS (Row Level Security)
ALTER TABLE omnia_administradoras ENABLE ROW LEVEL SECURITY;

-- Política para usuários autenticados visualizarem administradoras
CREATE POLICY "Usuários autenticados podem ver administradoras" ON omnia_administradoras
  FOR SELECT USING (auth.role() = 'authenticated');

-- Política para administradores criarem administradoras
CREATE POLICY "Administradores podem criar administradoras" ON omnia_administradoras
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.raw_user_meta_data->>'role' = 'ADMIN'
    )
  );

-- Política para administradores atualizarem administradoras
CREATE POLICY "Administradores podem atualizar administradoras" ON omnia_administradoras
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.raw_user_meta_data->>'role' = 'ADMIN'
    )
  );

-- Política para administradores excluírem administradoras
CREATE POLICY "Administradores podem excluir administradoras" ON omnia_administradoras
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.raw_user_meta_data->>'role' = 'ADMIN'
    )
  );

-- Criar função para atualizar updated_at automaticamente (se não existir)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Criar trigger para atualizar updated_at automaticamente
CREATE TRIGGER update_omnia_administradoras_updated_at
    BEFORE UPDATE ON omnia_administradoras
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Dados de exemplo
INSERT INTO omnia_administradoras (nome) VALUES
('Administradora Central'),
('Gestão Predial Ltda'),
('Condomínios & Cia');