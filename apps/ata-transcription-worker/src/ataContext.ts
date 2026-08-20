import type { SupabaseClient } from '@supabase/supabase-js'

// A doc é explícita: cada keyword é um literal de uma linha, sem os sinais de
// maior e menor. Passar um nome com quebra de linha invalida a requisição
// inteira, e uma assembleia deixaria de ser transcrita por causa de um cadastro
// com texto colado.
function sanitize(value: string | null | undefined): string {
  return (value ?? '').replace(/[<>]/g, ' ').replace(/\s+/g, ' ').trim()
}

// Um teto conservador: a lista serve para ancorar o que é específico daquela
// assembleia, não para despejar o cadastro inteiro no modelo.
const MAX_KEYWORDS = 40

// O que o modelo erra em assembleia não é vocabulário jurídico — é nome próprio.
// Nome do condomínio, do síndico, da administradora e de quem secretaria são
// exatamente as palavras que aparecem dezenas de vezes na gravação e que nenhum
// modelo tem como adivinhar.
const DOMAIN_KEYWORDS = [
  'assembleia geral ordinária',
  'assembleia geral extraordinária',
  'síndico',
  'subsíndico',
  'conselho fiscal',
  'convocação',
  'quórum',
  'pauta',
  'deliberação',
  'taxa condominial',
  'rateio',
  'balancete',
  'prestação de contas',
  'administradora',
  'condômino',
  'procuração',
  'convenção',
  'regimento interno',
  'inadimplência',
  'fundo de reserva',
]

export interface AtaContext {
  keywords: string[]
  prompt: string
}

export function buildAtaContext(input: {
  condominiumName?: string | null
  syndicName?: string | null
  managerName?: string | null
  secretaryName?: string | null
  title?: string | null
  tags?: string[] | null
}): AtaContext {
  const specific = [
    input.condominiumName,
    input.syndicName,
    input.managerName,
    input.secretaryName,
    input.title,
    ...(input.tags ?? []),
  ]
    .map(sanitize)
    .filter(Boolean)

  const seen = new Set<string>()
  const keywords: string[] = []
  for (const keyword of [...specific, ...DOMAIN_KEYWORDS]) {
    const key = keyword.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    keywords.push(keyword)
    if (keywords.length === MAX_KEYWORDS) break
  }

  const parts = ['Gravação de assembleia de condomínio em português do Brasil.']
  if (input.condominiumName) parts.push(`Condomínio: ${sanitize(input.condominiumName)}.`)
  if (input.syndicName) parts.push(`Síndico: ${sanitize(input.syndicName)}.`)
  if (input.managerName) parts.push(`Administradora: ${sanitize(input.managerName)}.`)
  if (input.secretaryName) parts.push(`Secretário da ata: ${sanitize(input.secretaryName)}.`)
  if (input.title) parts.push(`Assunto: ${sanitize(input.title)}.`)

  return { keywords, prompt: parts.join(' ') }
}

// Falha de contexto não pode derrubar a transcrição: sem os nomes o modelo
// transcreve pior, mas transcreve. Perder a gravação inteira porque o cadastro
// do condomínio sumiu seria uma troca terrível.
export async function loadAtaContext(
  // deno-lint-ignore no-explicit-any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  ataId: string,
): Promise<AtaContext> {
  try {
    const { data: ata } = await supabase
      .from('omnia_atas')
      .select('title, tags, condominium_id, secretary_id')
      .eq('id', ataId)
      .maybeSingle()
    if (!ata) return buildAtaContext({})

    const [condominium, secretary] = await Promise.all([
      ata.condominium_id
        ? supabase.from('omnia_condominiums').select('name, syndic_name, manager_name').eq('id', ata.condominium_id).maybeSingle()
        : Promise.resolve({ data: null }),
      ata.secretary_id
        ? supabase.from('omnia_users').select('name').eq('id', ata.secretary_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ])

    return buildAtaContext({
      condominiumName: condominium.data?.name,
      syndicName: condominium.data?.syndic_name,
      managerName: condominium.data?.manager_name,
      secretaryName: secretary.data?.name,
      title: ata.title,
      tags: ata.tags,
    })
  } catch (error) {
    console.error(`Could not load ata context for ${ataId}`, error)
    return buildAtaContext({})
  }
}
