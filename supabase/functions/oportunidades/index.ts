import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from '@supabase/supabase-js'

const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') || 'https://omnia.vercel.app'

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

// Interface para validação de dados
interface OportunidadeData {
  cliente: string
  numero_unidades?: number
  numero_funcionarios_proprios?: number
  numero_funcionarios_terceirizados?: number
  administradora_atual?: string
  observacoes?: string
  status: string
  origem_id?: string
  responsavel_negociacao?: string
  cep?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  cidade?: string
  estado?: string
  sindico_nome?: string
  sindico_telefone?: string
  sindico_email?: string
  sindico_whatsapp?: string
  valor_proposta?: number
  assigned_to?: string
}

// Função para validar dados de entrada
function validateOportunidadeData(data: Record<string, unknown>): { isValid: boolean; errors: string[] } {
  const errors: string[] = []
  
  // Validações obrigatórias
  if (!data.cliente || typeof data.cliente !== 'string' || data.cliente.trim().length === 0) {
    errors.push('Campo "cliente" é obrigatório e deve ser uma string não vazia')
  }
  
  if (!data.status || typeof data.status !== 'string' || data.status.trim().length === 0) {
    errors.push('Campo "status" é obrigatório e deve ser uma string não vazia (pode ser nome ou UUID)')
  }
  
  // Validações de tipo para campos opcionais
  if (data.numero_unidades !== undefined && (typeof data.numero_unidades !== 'number' || data.numero_unidades < 0)) {
    errors.push('Campo "numero_unidades" deve ser um número positivo')
  }
  
  if (data.numero_funcionarios_proprios !== undefined && (typeof data.numero_funcionarios_proprios !== 'number' || data.numero_funcionarios_proprios < 0)) {
    errors.push('Campo "numero_funcionarios_proprios" deve ser um número positivo')
  }
  
  if (data.numero_funcionarios_terceirizados !== undefined && (typeof data.numero_funcionarios_terceirizados !== 'number' || data.numero_funcionarios_terceirizados < 0)) {
    errors.push('Campo "numero_funcionarios_terceirizados" deve ser um número positivo')
  }
  
  if (data.valor_proposta !== undefined && (typeof data.valor_proposta !== 'number' || data.valor_proposta < 0)) {
    errors.push('Campo "valor_proposta" deve ser um número positivo')
  }
  
  // Validação de email
  if (data.sindico_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.sindico_email as string)) {
    errors.push('Campo "sindico_email" deve ter um formato de email válido')
  }
  
  // Validação de CEP
  if (data.cep && !/^\d{5}-?\d{3}$/.test(data.cep as string)) {
    errors.push('Campo "cep" deve ter o formato 00000-000 ou 00000000')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

// Função para resolver status ID (converte nome para UUID se necessário)
// deno-lint-ignore no-explicit-any
async function resolveStatusId(statusInput: string, supabaseClient: any): Promise<string | null> {
  try {
    // Verificar se já é um UUID válido
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (uuidRegex.test(statusInput)) {
      // Verificar se o UUID existe na tabela
      const { data: existingStatus, error } = await supabaseClient
        .from('omnia_crm_statuses')
        .select('id')
        .eq('id', statusInput)
        .single()
      
      if (error || !existingStatus) {
        return null
      }
      return statusInput
    }

    // Se não for UUID, buscar pelo nome
    const { data: statusData, error } = await supabaseClient
      .from('omnia_crm_statuses')
      .select('id')
      .ilike('name', statusInput.trim())
      .single()

    if (error || !statusData) {
      return null
    }

    return statusData.id
  } catch (error) {
    console.error('Erro ao resolver status ID:', error)
    return null
  }
}

// Autentica o usuário via JWT e verifica se possui role adequada
async function authenticateUser(authHeader: string): Promise<{ authorized: boolean; userId?: string }> {
  try {
    if (!authHeader) {
      return { authorized: false }
    }

    const token = authHeader.replace('Bearer ', '').replace('bearer ', '')

    const supabaseAnon = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    const { data: authData, error: authError } = await supabaseAnon.auth.getUser(token)
    if (authError || !authData.user) {
      return { authorized: false }
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('omnia_users')
      .select('id, roles')
      .eq('auth_user_id', authData.user.id)
      .single()

    if (profileError || !profile) {
      return { authorized: false }
    }

    const roles: string[] = profile.roles ?? []
    const hasAccess = roles.includes('ADMIN') || roles.includes('SECRETARIO') || roles.includes('USUARIO')
    return { authorized: hasAccess, userId: profile.id }
  } catch (error) {
    console.error('Erro na autenticação:', error)
    return { authorized: false }
  }
}

// Função para tratar erros de forma padronizada
function handleError(error: Error & { code?: string }, operation: string): Response {
  console.error(`Error in ${operation}:`, error)
  
  let statusCode = 500
  let message = 'Erro interno do servidor'
  
  if (error.code === '23505') {
    statusCode = 409
    message = 'Registro já existe'
  } else if (error.code === '23503') {
    statusCode = 400
    message = 'Referência inválida - verifique os dados relacionados'
  } else if (error.code === '42P01') {
    statusCode = 500
    message = 'Erro de configuração do banco de dados'
  } else if (error.message) {
    message = error.message
  }
  
  return new Response(
    JSON.stringify({ 
      error: message,
      code: error.code,
      operation 
    }),
    { 
      status: statusCode, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  )
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Verificar autenticação via JWT do usuário
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Token de autorização é obrigatório' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { authorized } = await authenticateUser(authHeader)
    if (!authorized) {
      return new Response(
        JSON.stringify({ error: 'Acesso negado. Token inválido ou usuário sem permissão.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Usar SERVICE_ROLE_KEY para queries internas (usuário já autenticado acima)
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    
    const supabaseClient = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const url = new URL(req.url)
    const pathParts = url.pathname.split('/').filter(Boolean)
    const oportunidadeId = pathParts[pathParts.length - 1]

    // GET - Listar todas as oportunidades ou buscar por ID
    if (req.method === 'GET') {
      try {
        // Se há um ID na URL, buscar oportunidade específica
        if (oportunidadeId && oportunidadeId !== 'oportunidades') {
          const { data: oportunidade, error } = await supabaseClient
            .from('omnia_crm_leads')
            .select('*')
            .eq('id', oportunidadeId)
            .single()

          if (error) {
            if (error.code === 'PGRST116') {
              return new Response(
                JSON.stringify({ error: 'Oportunidade não encontrada' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              )
            }
            return handleError(error, 'buscar oportunidade')
          }

          return new Response(
            JSON.stringify({ data: oportunidade }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Listar todas as oportunidades com filtros opcionais
        let query = supabaseClient
          .from('omnia_crm_leads')
          .select('*')

        // Aplicar filtros baseados em query parameters
        const status = url.searchParams.get('status')
        const responsavel = url.searchParams.get('responsavel')
        const origem = url.searchParams.get('origem')
        const cliente = url.searchParams.get('cliente')
        const limit = url.searchParams.get('limit')
        const offset = url.searchParams.get('offset')

        if (status) {
          query = query.eq('status', status)
        }
        if (responsavel) {
          query = query.eq('responsavel_negociacao', responsavel)
        }
        if (origem) {
          query = query.eq('origem_id', origem)
        }
        if (cliente) {
          query = query.ilike('cliente', `%${cliente}%`)
        }

        // Paginação
        if (limit) {
          const limitNum = parseInt(limit)
          if (limitNum > 0 && limitNum <= 1000) {
            query = query.limit(limitNum)
          }
        }
        if (offset) {
          const offsetNum = parseInt(offset)
          if (offsetNum >= 0) {
            query = query.range(offsetNum, offsetNum + (parseInt(limit || '50') - 1))
          }
        }

        query = query.order('created_at', { ascending: false })

        const { data: oportunidades, error } = await query

        if (error) {
          return handleError(error, 'listar oportunidades')
        }

        const response = { 
          data: oportunidades || [],
          count: oportunidades?.length || 0
        }

        return new Response(
          JSON.stringify(response),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      } catch (error) {
        return handleError(error, 'GET oportunidades')
      }
    }

    // POST - Criar nova oportunidade
    if (req.method === 'POST') {
      try {
        const body = await req.json()
        
        // Validar dados de entrada
        const validation = validateOportunidadeData(body)
        if (!validation.isValid) {
          return new Response(
            JSON.stringify({ 
              error: 'Dados inválidos',
              details: validation.errors 
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Resolver status (converter nome para UUID se necessário)
        const statusId = await resolveStatusId(body.status.trim(), supabaseClient)
        if (!statusId) {
          return new Response(
            JSON.stringify({ 
              error: 'Status inválido',
              details: [`Status "${body.status}" não encontrado`]
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Preparar dados para inserção
        const oportunidadeData: Partial<OportunidadeData> & { status: string } = {
          cliente: body.cliente.trim(),
          status: statusId,
          assigned_to: body.assigned_to
        }

        // Adicionar campos opcionais se fornecidos
        const optionalFields = [
          'numero_unidades', 'numero_funcionarios_proprios', 'numero_funcionarios_terceirizados',
          'administradora_atual', 'observacoes', 'origem_id', 'responsavel_negociacao',
          'cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'estado',
          'sindico_nome', 'sindico_telefone', 'sindico_email', 'sindico_whatsapp', 'valor_proposta'
        ]

        optionalFields.forEach(field => {
          if (body[field] !== undefined && body[field] !== null && body[field] !== '') {
            oportunidadeData[field] = body[field]
          }
        })

        const { data: novaOportunidade, error } = await supabaseClient
          .from('omnia_crm_leads')
          .insert({
            ...oportunidadeData,
            created_by: (oportunidadeData as Record<string, unknown>).created_by || null
          })
          .select()
          .single()

        if (error) {
          return handleError(error, 'criar oportunidade')
        }

        return new Response(
          JSON.stringify({ 
            data: novaOportunidade,
            message: 'Oportunidade criada com sucesso'
          }),
          { 
            status: 201, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )

      } catch (error) {
        return handleError(error, 'POST oportunidade')
      }
    }

    // PUT - Atualizar oportunidade existente
    if (req.method === 'PUT') {
      try {
        if (!oportunidadeId || oportunidadeId === 'oportunidades') {
          return new Response(
            JSON.stringify({ error: 'ID da oportunidade é obrigatório para atualização' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const body = await req.json()
        
        // Validar dados de entrada (menos restritivo para updates)
        if (body.cliente !== undefined) {
          if (!body.cliente || typeof body.cliente !== 'string' || body.cliente.trim().length === 0) {
            return new Response(
              JSON.stringify({ error: 'Campo "cliente" deve ser uma string não vazia' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
        }

        // Verificar se a oportunidade existe
        const { data: _existingOportunidade, error: checkError } = await supabaseClient
          .from('omnia_crm_leads')
          .select('id, created_by')
          .eq('id', oportunidadeId)
          .single()

        if (checkError) {
          if (checkError.code === 'PGRST116') {
            return new Response(
              JSON.stringify({ error: 'Oportunidade não encontrada' }),
              { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
          return handleError(checkError, 'verificar oportunidade')
        }

        // Preparar dados para atualização
        const updateData: Partial<OportunidadeData> = {}
        
        const allowedFields = [
          'cliente', 'numero_unidades', 'numero_funcionarios_proprios', 'numero_funcionarios_terceirizados',
          'administradora_atual', 'observacoes', 'status', 'origem_id', 'responsavel_negociacao',
          'cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'estado',
          'sindico_nome', 'sindico_telefone', 'sindico_email', 'sindico_whatsapp', 'valor_proposta', 'assigned_to'
        ]

        // Resolver status se fornecido (converter nome para UUID se necessário)
        if (body.status !== undefined) {
          const statusId = await resolveStatusId(body.status, supabaseClient)
          if (!statusId) {
            return new Response(
              JSON.stringify({ 
                error: 'Status inválido',
                details: [`Status "${body.status}" não encontrado`]
              }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
          updateData.status = statusId
        }

        allowedFields.forEach(field => {
          if (body[field] !== undefined && field !== 'status') {
            updateData[field] = body[field]
          }
        })

        if (Object.keys(updateData).length === 0) {
          return new Response(
            JSON.stringify({ error: 'Nenhum campo válido fornecido para atualização' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const { data: oportunidadeAtualizada, error } = await supabaseClient
          .from('omnia_crm_leads')
          .update(updateData)
          .eq('id', oportunidadeId)
          .select('*')
          .single()

        if (error) {
          return handleError(error, 'atualizar oportunidade')
        }

        return new Response(
          JSON.stringify({ 
            data: oportunidadeAtualizada,
            message: 'Oportunidade atualizada com sucesso'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      } catch (error) {
        return handleError(error, 'PUT oportunidade')
      }
    }

    // DELETE - Excluir oportunidade
    if (req.method === 'DELETE') {
      try {
        if (!oportunidadeId || oportunidadeId === 'oportunidades') {
          return new Response(
            JSON.stringify({ error: 'ID da oportunidade é obrigatório para exclusão' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Verificar se a oportunidade existe
        const { data: _existingOportunidade, error: checkError } = await supabaseClient
          .from('omnia_crm_leads')
          .select('id, created_by')
          .eq('id', oportunidadeId)
          .single()

        if (checkError) {
          if (checkError.code === 'PGRST116') {
            return new Response(
              JSON.stringify({ error: 'Oportunidade não encontrada' }),
              { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
          return handleError(checkError, 'verificar oportunidade')
        }

        // Verificar se há tarefas vinculadas
        const { data: tarefasVinculadas, error: tarefasError } = await supabaseClient
          .from('omnia_tickets')
          .select('id')
          .eq('oportunidade_id', oportunidadeId)
          .limit(1)

        if (tarefasError) {
          console.warn('Erro ao verificar tarefas vinculadas:', tarefasError)
        }

        if (tarefasVinculadas && tarefasVinculadas.length > 0) {
          return new Response(
            JSON.stringify({ 
              error: 'Não é possível excluir oportunidade com tarefas vinculadas',
              details: 'Remova ou desvincule as tarefas antes de excluir a oportunidade'
            }),
            { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const { error } = await supabaseClient
          .from('omnia_crm_leads')
          .delete()
          .eq('id', oportunidadeId)

        if (error) {
          return handleError(error, 'excluir oportunidade')
        }

        return new Response(
          JSON.stringify({ 
            message: 'Oportunidade excluída com sucesso',
            deletedId: oportunidadeId
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      } catch (error) {
        return handleError(error, 'DELETE oportunidade')
      }
    }

    // Método não suportado
    return new Response(
      JSON.stringify({ error: `Método ${req.method} não suportado` }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return handleError(error, 'processamento da requisição')
  }
})