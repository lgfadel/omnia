import { PostgrestError } from '@supabase/supabase-js'
import { logger } from './logging';


/**
 * Mapeia códigos de erro do PostgreSQL para mensagens mais específicas
 */
const ERROR_MESSAGES: Record<string, string> = {
  // Violações de constraint
  '23505': 'Este registro já existe no sistema',
  '23503': 'Não é possível realizar esta operação devido a dependências',
  '23502': 'Campos obrigatórios não foram preenchidos',
  '23514': 'Os dados fornecidos não atendem aos critérios de validação',
  
  // Erros de permissão
  '42501': 'Você não tem permissão para realizar esta operação',
  'PGRST116': 'Você não tem permissão para acessar este recurso',
  
  // Erros de conexão
  'PGRST301': 'Erro de conexão com o banco de dados',
  'PGRST204': 'Nenhum registro encontrado',
  
  // Erros de validação específicos
  'duplicate_key_value': 'Este registro já existe no sistema',
  'foreign_key_violation': 'Não é possível realizar esta operação devido a dependências',
  'not_null_violation': 'Campos obrigatórios não foram preenchidos',
  'check_violation': 'Os dados fornecidos não atendem aos critérios de validação',
}

/**
 * Mapeia erros específicos por tabela/operação
 */
const SPECIFIC_ERROR_MESSAGES: Record<string, Record<string, string>> = {
  omnia_condominiums: {
    '23505': 'Já existe um condomínio cadastrado com este CNPJ',
    'duplicate_key_value': 'Já existe um condomínio cadastrado com este CNPJ',
  },
  users: {
    '23505': 'Já existe um usuário cadastrado com este email',
    'duplicate_key_value': 'Já existe um usuário cadastrado com este email',
  },
  omnia_administradoras: {
    '23505': 'Já existe uma administradora cadastrada com este nome',
    'duplicate_key_value': 'Já existe uma administradora cadastrada com este nome',
  },
  omnia_tags: {
    '23505': 'Já existe uma tag cadastrada com este nome',
    'duplicate_key_value': 'Já existe uma tag cadastrada com este nome',
  },
  omnia_tickets: {
    '23503': 'Não é possível criar a tarefa. Verifique se o condomínio e responsável existem',
    'foreign_key_violation': 'Não é possível criar a tarefa. Verifique se o condomínio e responsável existem',
  },
  omnia_atas: {
    '23503': 'Não é possível criar a ata. Verifique se o condomínio existe',
    'foreign_key_violation': 'Não é possível criar a ata. Verifique se o condomínio existe',
  }
}

/**
 * Interface para erro tratado
 */
export interface TreatedError {
  message: string
  code?: string
  details?: string
  isUserFriendly: boolean
}

/**
 * Trata erros do Supabase e retorna mensagens mais específicas
 */
export function handleSupabaseError(
  error: unknown,
  context?: {
    operation?: 'create' | 'update' | 'delete' | 'read'
    table?: string
    entity?: string
  }
): TreatedError {
  // Se não é um erro, retorna erro genérico
  if (!error) {
    return {
      message: 'Ocorreu um erro inesperado',
      isUserFriendly: true
    }
  }

  // Type narrowing para objetos com propriedades de erro
  const errorObj = error as { code?: string; message?: string; toString?: () => string }

  // Se é um erro do Supabase/PostgreSQL
  if (errorObj.code || errorObj.message) {
    const errorCode = errorObj.code || extractErrorCode(errorObj.message || '')
    const table = context?.table || extractTableFromError(error)
    
    // Verifica se há mensagem específica para a tabela
    if (table && SPECIFIC_ERROR_MESSAGES[table]?.[errorCode]) {
      return {
        message: SPECIFIC_ERROR_MESSAGES[table][errorCode],
        code: errorCode,
        details: errorObj.message,
        isUserFriendly: true
      }
    }
    
    // Verifica se há mensagem genérica para o código
    if (ERROR_MESSAGES[errorCode]) {
      return {
        message: ERROR_MESSAGES[errorCode],
        code: errorCode,
        details: errorObj.message,
        isUserFriendly: true
      }
    }
  }

  // Tratamento por operação e entidade
  if (context?.operation && context?.entity) {
    const operationMessages = {
      create: `Erro ao criar ${context.entity}`,
      update: `Erro ao atualizar ${context.entity}`,
      delete: `Erro ao excluir ${context.entity}`,
      read: `Erro ao carregar ${context.entity}`
    }
    
    return {
      message: operationMessages[context.operation],
      details: errorObj.message || (errorObj.toString ? errorObj.toString() : String(error)),
      isUserFriendly: true
    }
  }

  // Fallback para erro genérico
  return {
    message: errorObj.message || 'Ocorreu um erro inesperado',
    details: errorObj.toString ? errorObj.toString() : String(error),
    isUserFriendly: false
  }
}

/**
 * Extrai código de erro da mensagem
 */
function extractErrorCode(message: string): string {
  // Procura por códigos PostgreSQL na mensagem
  const pgCodeMatch = message.match(/\b(\d{5})\b/)
  if (pgCodeMatch) {
    return pgCodeMatch[1]
  }
  
  // Procura por tipos de violação
  if (message.includes('duplicate key value')) {
    return 'duplicate_key_value'
  }
  if (message.includes('foreign key constraint')) {
    return 'foreign_key_violation'
  }
  if (message.includes('not-null constraint')) {
    return 'not_null_violation'
  }
  if (message.includes('check constraint')) {
    return 'check_violation'
  }
  
  return 'unknown'
}

/**
 * Extrai nome da tabela do erro
 */
function extractTableFromError(error: unknown): string | null {
  const errorObj = error as { message?: string; toString?: () => string }
  const message = errorObj.message || (errorObj.toString ? errorObj.toString() : String(error))
  
  // Procura por nomes de tabela na mensagem (com e sem prefixo omnia_)
  const tableMatch = message.match(/table "((?:omnia_)?\w+)"/)
  if (tableMatch) {
    return tableMatch[1]
  }
  
  // Procura por constraint names que geralmente incluem o nome da tabela
  const constraintMatch = message.match(/((?:omnia_)?\w+)_/)
  if (constraintMatch) {
    return constraintMatch[1]
  }
  
  return null
}

/**
 * Hook para usar o tratamento de erros com toast
 */
export function useErrorHandler() {
  return {
    handleError: (error: unknown, context?: Parameters<typeof handleSupabaseError>[1]) => {
      const treatedError = handleSupabaseError(error, context)
      logger.error('Error handled:', {
        original: error,
        treated: treatedError,
        context
      })
      return treatedError
    }
  }
}

/**
 * Utilitário para criar contexto de erro
 */
export function createErrorContext(
  operation: 'create' | 'update' | 'delete' | 'read',
  entity: string,
  table?: string
) {
  return { operation, entity, table }
}