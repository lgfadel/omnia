# API de Oportunidades - Endpoint Supabase Edge Functions

## Visão Geral

Este endpoint fornece operações CRUD completas para a tabela `omnia_crm_leads` (oportunidades) através de Supabase Edge Functions, otimizado para integração com n8n e outras ferramentas de automação.

## URL Base

```
https://[SEU_PROJETO].supabase.co/functions/v1/oportunidades
```

## Autenticação

Todas as requisições requerem um token de autorização válido no header:

```
Authorization: Bearer [SEU_TOKEN_JWT]
```

**Requisitos:**
- Token JWT válido do Supabase Auth
- Usuário autenticado no sistema

## Endpoints Disponíveis

### 1. Listar Oportunidades
**GET** `/oportunidades`

Lista todas as oportunidades com filtros opcionais.

#### Parâmetros de Query (Opcionais)

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `status` | string | Filtrar por status |
| `responsavel` | string | Filtrar por ID do responsável |
| `origem` | string | Filtrar por ID da origem |
| `cliente` | string | Buscar por nome do cliente (busca parcial) |
| `limit` | number | Limite de registros (máx: 1000, padrão: 50) |
| `offset` | number | Offset para paginação |

#### Exemplo de Requisição

```bash
curl -X GET "https://[SEU_PROJETO].supabase.co/functions/v1/oportunidades?status=ativo&limit=10" \
  -H "Authorization: Bearer [SEU_TOKEN]" \
  -H "Content-Type: application/json"
```

#### Resposta de Sucesso (200)

```json
{
  "data": [
    {
      "id": "uuid",
      "cliente": "Condomínio Exemplo",
      "numero_unidades": 120,
      "status": "ativo",
      "origem_id": "uuid",
      "responsavel_negociacao": "uuid",
      "valor_proposta": 15000.00,
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z",
      "responsavel_user": {
        "id": "uuid",
        "name": "João Silva",
        "avatar_url": "url",
        "color": "#FF5733"
      },
      "origem": {
        "id": "uuid",
        "name": "Website",
        "color": "#007BFF",
        "is_default": false
      }
    }
  ],
  "count": 1
}
```

### 2. Buscar Oportunidade por ID
**GET** `/oportunidades/{id}`

Retorna uma oportunidade específica pelo ID.

#### Exemplo de Requisição

```bash
curl -X GET "https://[SEU_PROJETO].supabase.co/functions/v1/oportunidades/123e4567-e89b-12d3-a456-426614174000" \
  -H "Authorization: Bearer [SEU_TOKEN]" \
  -H "Content-Type: application/json"
```

#### Resposta de Sucesso (200)

```json
{
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "cliente": "Condomínio Exemplo",
    "numero_unidades": 120,
    "numero_funcionarios_proprios": 5,
    "numero_funcionarios_terceirizados": 15,
    "administradora_atual": "Administradora XYZ",
    "observacoes": "Cliente interessado em modernização",
    "status": "ativo",
    "origem_id": "uuid",
    "responsavel_negociacao": "uuid",
    "cep": "01234-567",
    "logradouro": "Rua das Flores",
    "numero": "123",
    "complemento": "Bloco A",
    "bairro": "Centro",
    "cidade": "São Paulo",
    "estado": "SP",
    "sindico_nome": "Maria Santos",
    "sindico_telefone": "(11) 99999-9999",
    "sindico_email": "maria@email.com",
    "sindico_whatsapp": "(11) 99999-9999",
    "valor_proposta": 15000.00,
    "assigned_to": "uuid",
    "created_by": "uuid",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  }
}
```

#### Resposta de Erro (404)

```json
{
  "error": "Oportunidade não encontrada"
}
```

### 3. Criar Nova Oportunidade
**POST** `/oportunidades`

Cria uma nova oportunidade.

#### Campos Obrigatórios

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `cliente` | string | Nome do cliente |
| `status` | string | Status da oportunidade |

#### Campos Opcionais

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `numero_unidades` | number | Número de unidades |
| `numero_funcionarios_proprios` | number | Funcionários próprios |
| `numero_funcionarios_terceirizados` | number | Funcionários terceirizados |
| `administradora_atual` | string | Administradora atual |
| `observacoes` | string | Observações gerais |
| `origem_id` | string | ID da origem |
| `responsavel_negociacao` | string | ID do responsável |
| `cep` | string | CEP (formato: 00000-000) |
| `logradouro` | string | Endereço |
| `numero` | string | Número do endereço |
| `complemento` | string | Complemento |
| `bairro` | string | Bairro |
| `cidade` | string | Cidade |
| `estado` | string | Estado |
| `sindico_nome` | string | Nome do síndico |
| `sindico_telefone` | string | Telefone do síndico |
| `sindico_email` | string | Email do síndico |
| `sindico_whatsapp` | string | WhatsApp do síndico |
| `valor_proposta` | number | Valor da proposta |
| `assigned_to` | string | ID do usuário responsável |

#### Exemplo de Requisição

```bash
curl -X POST "https://[SEU_PROJETO].supabase.co/functions/v1/oportunidades" \
  -H "Authorization: Bearer [SEU_TOKEN]" \
  -H "Content-Type: application/json" \
  -d '{
    "cliente": "Condomínio Novo Cliente",
    "status": "prospeccao",
    "numero_unidades": 80,
    "valor_proposta": 12000.00,
    "sindico_nome": "Carlos Silva",
    "sindico_email": "carlos@email.com",
    "cep": "01234-567",
    "cidade": "São Paulo",
    "estado": "SP"
  }'
```

#### Resposta de Sucesso (201)

```json
{
  "data": {
    "id": "novo-uuid",
    "cliente": "Condomínio Novo Cliente",
    "status": "prospeccao",
    "numero_unidades": 80,
    "valor_proposta": 12000.00,
    "created_at": "2024-01-15T11:00:00Z",
    "created_by": "uuid-usuario"
  },
  "message": "Oportunidade criada com sucesso"
}
```

#### Resposta de Erro (400)

```json
{
  "error": "Dados inválidos",
  "details": [
    "Campo \"cliente\" é obrigatório e deve ser uma string não vazia",
    "Campo \"sindico_email\" deve ter um formato de email válido"
  ]
}
```

### 4. Atualizar Oportunidade
**PUT** `/oportunidades/{id}`

Atualiza uma oportunidade existente.

#### Exemplo de Requisição

```bash
curl -X PUT "https://[SEU_PROJETO].supabase.co/functions/v1/oportunidades/123e4567-e89b-12d3-a456-426614174000" \
  -H "Authorization: Bearer [SEU_TOKEN]" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "negociacao",
    "valor_proposta": 18000.00,
    "observacoes": "Cliente demonstrou interesse em expandir contrato"
  }'
```

#### Resposta de Sucesso (200)

```json
{
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "cliente": "Condomínio Exemplo",
    "status": "negociacao",
    "valor_proposta": 18000.00,
    "observacoes": "Cliente demonstrou interesse em expandir contrato",
    "updated_at": "2024-01-15T12:00:00Z"
  },
  "message": "Oportunidade atualizada com sucesso"
}
```

### 5. Excluir Oportunidade
**DELETE** `/oportunidades/{id}`

Exclui uma oportunidade. Não é possível excluir oportunidades que possuem tarefas vinculadas.

#### Exemplo de Requisição

```bash
curl -X DELETE "https://[SEU_PROJETO].supabase.co/functions/v1/oportunidades/123e4567-e89b-12d3-a456-426614174000" \
  -H "Authorization: Bearer [SEU_TOKEN]"
```

#### Resposta de Sucesso (200)

```json
{
  "message": "Oportunidade excluída com sucesso",
  "deletedId": "123e4567-e89b-12d3-a456-426614174000"
}
```

#### Resposta de Erro (409)

```json
{
  "error": "Não é possível excluir oportunidade com tarefas vinculadas",
  "details": "Remova ou desvincule as tarefas antes de excluir a oportunidade"
}
```

## Códigos de Status HTTP

| Código | Descrição |
|--------|-----------|
| 200 | Sucesso |
| 201 | Criado com sucesso |
| 400 | Dados inválidos |
| 401 | Token de autorização ausente |
| 403 | Token inválido ou usuário não autenticado |
| 404 | Recurso não encontrado |
| 405 | Método não suportado |
| 409 | Conflito (ex: tentativa de excluir com dependências) |
| 500 | Erro interno do servidor |

## Integração com n8n

### Configuração do HTTP Request Node

1. **Method**: Selecione o método HTTP apropriado (GET, POST, PUT, DELETE)
2. **URL**: `https://[SEU_PROJETO].supabase.co/functions/v1/oportunidades`
3. **Authentication**: 
   - Type: `Generic Credential Type`
   - Generic Auth Type: `Header Auth`
   - Name: `Authorization`
   - Value: `Bearer [SEU_TOKEN]`

### Exemplos de Workflows n8n

#### 1. Criar Oportunidade a partir de Formulário

```json
{
  "nodes": [
    {
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "parameters": {
        "httpMethod": "POST",
        "path": "nova-oportunidade"
      }
    },
    {
      "name": "Criar Oportunidade",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "method": "POST",
        "url": "https://[SEU_PROJETO].supabase.co/functions/v1/oportunidades",
        "authentication": "genericCredentialType",
        "genericAuthType": "headerAuth",
        "sendBody": true,
        "bodyContentType": "json",
        "jsonBody": "={{ $json }}"
      }
    }
  ]
}
```

#### 2. Sincronizar Status com Sistema Externo

```json
{
  "nodes": [
    {
      "name": "Schedule Trigger",
      "type": "n8n-nodes-base.scheduleTrigger",
      "parameters": {
        "rule": {
          "interval": [{"field": "hours", "value": 1}]
        }
      }
    },
    {
      "name": "Buscar Oportunidades",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "method": "GET",
        "url": "https://[SEU_PROJETO].supabase.co/functions/v1/oportunidades?status=ativo"
      }
    },
    {
      "name": "Processar Cada Oportunidade",
      "type": "n8n-nodes-base.splitInBatches",
      "parameters": {
        "batchSize": 10
      }
    }
  ]
}
```

## Tratamento de Erros

O endpoint retorna erros estruturados com informações detalhadas:

```json
{
  "error": "Descrição do erro",
  "code": "CODIGO_ERRO_DB",
  "operation": "operacao_que_falhou",
  "details": ["detalhes", "adicionais"]
}
```

## Validações Implementadas

- **Cliente**: Obrigatório, string não vazia
- **Status**: Obrigatório, string não vazia  
- **Email**: Formato de email válido
- **CEP**: Formato brasileiro (00000-000 ou 00000000)
- **Números**: Valores positivos para campos numéricos
- **Autenticação**: Verificação de token JWT válido
- **Dependências**: Verificação de tarefas vinculadas antes da exclusão

## Logs e Monitoramento

Todos os erros são logados no console do Supabase Edge Functions para facilitar o debugging e monitoramento.

## Considerações de Performance

- Paginação implementada para listagens grandes
- Índices recomendados na tabela `omnia_crm_leads`:
  - `status`
  - `responsavel_negociacao`
  - `origem_id`
  - `created_at`

## Segurança

- Autenticação obrigatória via JWT
- Verificação de token válido do Supabase Auth
- Validação rigorosa de dados de entrada
- Proteção contra SQL injection via Supabase client
- Headers CORS configurados adequadamente