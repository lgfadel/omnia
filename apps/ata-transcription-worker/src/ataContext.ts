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

// A convocação é texto de documento, não cadastro: os nomes que importam estão
// lá em caixa alta inicial, no meio de frases. Sequências assim são justamente
// o que o modelo erra ao ouvir — nome de condomínio, de síndico, de rua, de
// empresa — e o que `keywords` existe para ancorar.
const TITLE_CASE_SEQUENCE = /[A-ZÀ-Ú][\wà-ú'-]{2,}(?:\s+(?:d[aeo]s?\s+)?[A-ZÀ-Ú][\wà-ú'-]{2,}){0,3}/g

// A captura pega a sequência inteira em caixa alta inicial, e no edital ela vem
// colada ao cargo ou ao tipo do empreendimento: "Síndico Eduardo Marchetti",
// "CONDOMÍNIO EDIFÍCIO VILA NOVA". Guardar assim quebra duas coisas — o nome
// não casa com o que se diz na assembleia, e a mesma pessoa vira duas keywords.
// Por isso a poda é por token, nas pontas.
const STOP_TOKENS = new Set([
  'a', 'o', 'os', 'as', 'e', 'de', 'da', 'do', 'das', 'dos', 'em', 'no', 'na', 'ao', 'aos',
  'assembleia', 'assembleias', 'geral', 'ordinária', 'ordinaria', 'extraordinária', 'extraordinaria',
  'edital', 'convocação', 'convocacao', 'ordem', 'dia', 'pauta', 'anexo', 'obs',
  'condomínio', 'condominio', 'edifício', 'edificio', 'residencial', 'bloco', 'torre',
  'síndico', 'sindico', 'síndica', 'sindica', 'subsíndico', 'subsindico', 'conselho', 'fiscal',
  'prestação', 'prestacao', 'contas', 'balancete', 'convenção', 'convencao', 'regimento',
  'senhores', 'senhoras', 'condôminos', 'condominos', 'condômino', 'condomino',
  'primeira', 'segunda', 'terceira', 'data', 'hora', 'horário', 'horario', 'local',
  'cnpj', 'rua', 'avenida', 'nos', 'termos', 'fica', 'ficam',
])

function normalizeToken(token: string): string {
  return token.toLowerCase().replace(/[^0-9a-zà-ú]/g, '')
}

// Sequência que sobra vazia era só jargão; jargão já está na lista fixa e não
// precisa de vaga aqui.
function trimStopTokens(sequence: string): string {
  const tokens = sequence.split(/\s+/)
  let start = 0
  let end = tokens.length
  while (start < end && STOP_TOKENS.has(normalizeToken(tokens[start]))) start += 1
  while (end > start && STOP_TOKENS.has(normalizeToken(tokens[end - 1]))) end -= 1
  return tokens.slice(start, end).join(' ')
}

export function extractConvocationKeywords(text: string): string[] {
  const counts = new Map<string, { display: string; hits: number }>()
  for (const match of text.matchAll(TITLE_CASE_SEQUENCE)) {
    const display = trimStopTokens(match[0].replace(/\s+/g, ' ').trim())
    const key = display.toLowerCase()
    if (display.length < 4) continue
    const entry = counts.get(key)
    if (entry) entry.hits += 1
    else counts.set(key, { display, hits: 1 })
  }
  // Nome que aparece mais de uma vez na convocação é nome que vai aparecer
  // dezenas de vezes na gravação; ele entra na frente.
  return [...counts.values()]
    .sort((a, b) => b.hits - a.hits || b.display.length - a.display.length)
    .map((entry) => entry.display)
}

export function buildAtaContext(input: {
  condominiumName?: string | null
  syndicName?: string | null
  managerName?: string | null
  secretaryName?: string | null
  title?: string | null
  tags?: string[] | null
  convocationText?: string | null
}): AtaContext {
  const convocationText = sanitize(input.convocationText)
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
    // O cadastro vem primeiro: ele é digitado por gente, a convocação é lida por
    // heurística. Quando os dois trazem o mesmo nome, prevalece o do cadastro.
    .concat(convocationText ? extractConvocationKeywords(convocationText) : [])

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
  // O edital entra por último e inteiro: é contexto não estruturado, que é
  // exatamente o que o prompt aceita, e traz a pauta com as palavras que serão
  // ditas na assembleia.
  if (convocationText) parts.push(`Convocação: ${convocationText}`)

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
  convocationText?: string | null,
): Promise<AtaContext> {
  try {
    const { data: ata } = await supabase
      .from('omnia_atas')
      .select('title, tags, condominium_id, secretary_id')
      .eq('id', ataId)
      .maybeSingle()
    if (!ata) return buildAtaContext({ convocationText })

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
      convocationText,
    })
  } catch (error) {
    console.error(`Could not load ata context for ${ataId}`, error)
    return buildAtaContext({ convocationText })
  }
}
