// A convocação da assembleia traz, com carimbo e sem ambiguidade, o que nenhum
// modelo tem como adivinhar: o nome do condomínio, o do síndico, a data e a
// pauta inteira. Ela é o melhor contexto que existe para a transcrição — e o
// texto dela é lido aqui, no navegador, para que quem envia veja na hora se o
// PDF é aproveitável, em vez de descobrir meia hora depois que era um scan.

export interface ConvocacaoContext {
  text: string
  pages: number
  condominio?: string
  sindico?: string
  data?: string
  pautaItems: string[]
}

// Um PDF de imagem devolve quase nada de texto. Abaixo disto não há contexto
// nenhum a extrair, e insistir só pioraria o prompt com ruído.
const MIN_USEFUL_CHARS = 120

// Só o começo da convocação interessa ao prompt: cabeçalho e pauta. O resto é
// quórum, procuração e boilerplate que se repete em toda convocação do país.
const MAX_CONTEXT_CHARS = 4000

export class ConvocacaoSemTextoError extends Error {
  constructor() {
    super('Este PDF não tem texto selecionável — provavelmente é um documento escaneado. Envie o arquivo original da convocação.')
    this.name = 'ConvocacaoSemTextoError'
  }
}

function findLabeled(text: string, labels: string[]): string | undefined {
  for (const label of labels) {
    const match = new RegExp(`${label}\\s*[:\\-–]\\s*([^\\n]{3,80})`, 'i').exec(text)
    if (match) return match[1].trim().replace(/[.,;]+$/, '')
  }
  return undefined
}

// Nome de pessoa não termina no fim da linha: "Síndico: Eduardo Marchetti
// convoca os senhores condôminos..." é uma frase inteira, e guardar a frase
// inteira como nome envenenaria as keywords. O nome é a sequência em caixa
// alta inicial, com os conectivos que os nomes brasileiros usam.
const NAME_SHAPE = "([A-ZÀ-Ú][\\wà-ú'.-]+(?:\\s+(?:d[aeo]s?\\s+)?[A-ZÀ-Ú][\\wà-ú'.-]+){0,4})"

// O rótulo é procurado sem diferenciar caixa, o nome não: com o flag "i" a
// forma "começa em maiúscula" deixa de significar coisa alguma e o nome passa a
// engolir a frase inteira que vem depois dele.
function findLabeledName(text: string, labels: string[]): string | undefined {
  for (const label of labels) {
    const labelMatch = new RegExp(`${label}\\s*[:\\-–]?\\s*`, 'i').exec(text)
    if (!labelMatch) continue
    const nameMatch = new RegExp(`^${NAME_SHAPE}`).exec(text.slice(labelMatch.index + labelMatch[0].length))
    if (nameMatch) return nameMatch[1].trim().replace(/[.,;]+$/, '')
  }
  return undefined
}

// Em assinatura, o rótulo vem depois do nome, não antes: o nome ocupa a
// própria linha e "Síndico" aparece sozinho logo abaixo, como carimbo.
function findNameBeforeLabel(text: string, labels: string[]): string | undefined {
  const lines = text.split('\n').map((line) => line.trim())
  for (const label of labels) {
    const labelLine = new RegExp(`^${label}[:.]?$`, 'i')
    const index = lines.findIndex((line) => labelLine.test(line))
    if (index <= 0) continue
    const nameMatch = new RegExp(`^${NAME_SHAPE}$`).exec(lines[index - 1])
    if (nameMatch) return nameMatch[1].trim().replace(/[.,;]+$/, '')
  }
  return undefined
}

function findCondominio(text: string): string | undefined {
  const labeled = findLabeled(text, ['condom[íi]nio', 'edif[íi]cio', 'residencial'])
  if (labeled) return labeled
  // Sem rótulo, o nome costuma vir no cabeçalho, em caixa alta e precedido do
  // tipo do empreendimento.
  const prefixed = /\b(?:CONDOM[ÍI]NIO|EDIF[ÍI]CIO|RESIDENCIAL)\s+([A-ZÀ-Ú0-9][A-ZÀ-Ú0-9\s.'-]{3,60})/.exec(text)
  if (prefixed) return `${prefixed[0].split(/\s+/)[0]} ${prefixed[1].trim()}`.replace(/\s+/g, ' ')
  // Sem prefixo nenhum ("Florais Eco Resort e Residence"), o nome ainda
  // costuma se apresentar assim: "o <nome>, localizado na Rua...".
  const intro = /\bo\s+([A-ZÀ-Ú][A-ZÀ-Ú0-9À-Ú\s.,'-]{3,70}?),?\s+(?:localizad[oa]|situad[oa])\b/.exec(text)
  return intro ? intro[1].trim().replace(/[.,;]+$/, '').replace(/\s+/g, ' ') : undefined
}

function findData(text: string): string | undefined {
  const numeric = /\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/.exec(text)
  if (numeric) return numeric[1]
  const written = /\b(\d{1,2}\s+de\s+[a-zà-ú]+\s+de\s+\d{4})\b/i.exec(text)
  return written?.[1]
}

// A pauta é o vocabulário daquela assembleia: "reforma da fachada", "rateio do
// elevador social". É o que o modelo mais erra e o que a convocação mais ajuda.
function findPautaItems(text: string): string[] {
  const items: string[] = []
  const markerLine = /^\s*(?:[a-z]\)|\d{1,2}[).º°-]|[-•])\s*(.{1,120})$/i
  const start = /ordem\s+do\s+dia|pauta/i.exec(text)
  const scope = start ? text.slice(start.index) : text
  const lines = scope.split('\n')

  for (let i = 0; i < lines.length && items.length < 20; i += 1) {
    const match = markerLine.exec(lines[i])
    if (!match) continue

    // O PDF quebra a frase no meio, não a pauta: um marcador sem pontuação
    // final é sinal de que o item continua na(s) linha(s) seguinte(s), até
    // achar o fim da frase, uma linha em branco ou o próximo marcador.
    let item = match[1].trim()
    let next = i + 1
    while (next < lines.length && item.length < 120 && !/[.;:]$/.test(item)) {
      const line = lines[next].trim()
      if (!line || markerLine.test(lines[next])) break
      item = `${item} ${line}`.trim()
      next += 1
    }
    i = next - 1

    item = item.replace(/[;.]+$/, '')
    if (item.length >= 6 && !items.includes(item)) items.push(item)
  }
  return items
}

export function parseConvocacao(rawText: string, pages: number): ConvocacaoContext {
  const text = rawText.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
  if (text.length < MIN_USEFUL_CHARS) throw new ConvocacaoSemTextoError()

  return {
    text: text.slice(0, MAX_CONTEXT_CHARS),
    pages,
    condominio: findCondominio(text),
    sindico:
      findLabeledName(text, ['s[íi]ndic[oa] geral', 's[íi]ndic[oa]']) ??
      findNameBeforeLabel(text, ['s[íi]ndic[oa] geral', 's[íi]ndic[oa]']),
    data: findData(text),
    pautaItems: findPautaItems(text),
  }
}

export async function readConvocacao(file: File): Promise<ConvocacaoContext> {
  // pdfjs entra por import dinâmico: são centenas de kB que não podem pesar no
  // carregamento de uma tela que quase sempre não vai anexar convocação nenhuma.
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

  const document = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
  try {
    const pages: string[] = []
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber)
      const content = await page.getTextContent()
      // getTextContent() não devolve linhas: cada item vem com hasEOL dizendo
      // se uma quebra de linha o segue no PDF original. Ignorar isso colapsa
      // a página inteira numa string só, e "1) ..." no meio dela deixa de
      // bater com o `^...$` que findPautaItems usa por linha.
      pages.push(
        content.items
          .map((item) => ('str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : ''))
          .join(''),
      )
    }
    return parseConvocacao(pages.join('\n'), document.numPages)
  } finally {
    await document.destroy()
  }
}
