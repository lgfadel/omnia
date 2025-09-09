# Estrutura SQL - Tabela omnia_administradoras

## Descrição
Tabela para armazenar informações das administradoras de condomínios.

## Estrutura da Tabela

```sql
CREATE TABLE omnia_administradoras (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Índices

```sql
-- Índice para busca por nome
CREATE INDEX idx_omnia_administradoras_nome ON omnia_administradoras(nome);

-- Índice para filtrar por status ativo
CREATE INDEX idx_omnia_administradoras_ativo ON omnia_administradoras(ativo);
```

## RLS (Row Level Security)

```sql
-- Habilitar RLS
ALTER TABLE omnia_administradoras ENABLE ROW LEVEL SECURITY;

-- Política para usuários autenticados
CREATE POLICY "Usuários autenticados podem ver administradoras" ON omnia_administradoras
  FOR SELECT USING (auth.role() = 'authenticated');

-- Política para administradores criarem
CREATE POLICY "Administradores podem criar administradoras" ON omnia_administradoras
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.raw_user_meta_data->>'role' = 'ADMIN'
    )
  );

-- Política para administradores atualizarem
CREATE POLICY "Administradores podem atualizar administradoras" ON omnia_administradoras
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.raw_user_meta_data->>'role' = 'ADMIN'
    )
  );

-- Política para administradores excluírem
CREATE POLICY "Administradores podem excluir administradoras" ON omnia_administradoras
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.raw_user_meta_data->>'role' = 'ADMIN'
    )
  );
```

## Trigger para updated_at

```sql
-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para omnia_administradoras
CREATE TRIGGER update_omnia_administradoras_updated_at
    BEFORE UPDATE ON omnia_administradoras
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

## Dados de Exemplo

```sql
INSERT INTO omnia_administradoras (nome) VALUES
('Administradora Central'),
('Gestão Predial Ltda'),
('Condomínios & Cia');
```

## Relacionamentos

- Esta tabela será referenciada por:
  - `omnia_crm_leads.administradora_atual` (como string do nome)
  - Futuras tabelas de condomínios que podem ter referência à administradora

## Observações

- O campo `ativo` permite desativar administradoras sem excluí-las
- Estrutura simplificada contendo apenas ID e nome da administradora
- O trigger `update_updated_at_omnia_administradoras` atualiza automaticamente o campo `updated_at`
- As políticas RLS garantem que apenas usuários autenticados possam acessar os dados