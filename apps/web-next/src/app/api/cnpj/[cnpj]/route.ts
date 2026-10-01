import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { CNPJServiceError, type CNPJErrorCode } from '@/lib/cnpj'
import { fetchCNPJData } from '@/server/cnpjLookup'

export const runtime = 'nodejs'
export const maxDuration = 30

const headers = { 'Cache-Control': 'no-store' }
const errorStatus: Record<CNPJErrorCode, number> = {
  INVALID_FORMAT: 400,
  NOT_FOUND: 404,
  API_ERROR: 502,
  INACTIVE: 422,
  UNAUTHORIZED: 401,
}

export async function GET(request: Request, context: { params: Promise<{ cnpj: string }> }) {
  try {
    const token = request.headers.get('Authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1]
    if (!token) {
      throw new CNPJServiceError('Entre novamente para consultar o CNPJ.', 'UNAUTHORIZED')
    }

    const { cnpj } = await context.params
    if (!/^\d{14}$/.test(cnpj)) {
      throw new CNPJServiceError('CNPJ deve conter 14 dígitos', 'INVALID_FORMAT')
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) {
      return NextResponse.json(
        { error: 'Consulta de CNPJ indisponível no momento.', code: 'API_ERROR' },
        { status: 503, headers }
      )
    }

    const supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data.user) {
      throw new CNPJServiceError('Sua sessão expirou. Entre novamente para consultar o CNPJ.', 'UNAUTHORIZED')
    }

    return NextResponse.json(await fetchCNPJData(cnpj), { headers })
  } catch (error) {
    const serviceError = error instanceof CNPJServiceError
      ? error
      : new CNPJServiceError('Erro ao buscar CNPJ. Tente novamente ou preencha os dados manualmente.', 'API_ERROR')
    return NextResponse.json(
      { error: serviceError.message, code: serviceError.code },
      { status: errorStatus[serviceError.code], headers }
    )
  }
}
