import { describe, expect, it } from 'vitest'
import { buildAtaContext, extractConvocationKeywords } from '../ataContext.js'

const CONVOCACAO = `CONDOMÍNIO EDIFÍCIO VILA NOVA ESPLANADA. EDITAL DE CONVOCAÇÃO.
O Síndico Eduardo Marchetti convoca para a Assembleia Geral Ordinária.
ORDEM DO DIA: a) Prestação de contas. b) Reforma da fachada pela Construtora Ipê.
Eduardo Marchetti responderá às dúvidas.`

describe('extractConvocationKeywords', () => {
  it('pulls the proper names the model has no way of guessing', () => {
    const keywords = extractConvocationKeywords(CONVOCACAO)

    expect(keywords).toContain('Eduardo Marchetti')
    expect(keywords.some((keyword) => keyword.includes('VILA NOVA ESPLANADA'))).toBe(true)
    expect(keywords).toContain('Construtora Ipê')
  })

  it('puts the recurring name first, because it will recur in the recording too', () => {
    const keywords = extractConvocationKeywords(CONVOCACAO)
    expect(keywords[0]).toBe('Eduardo Marchetti')
  })

  it('leaves out the boilerplate that is capitalised without naming anyone', () => {
    const keywords = extractConvocationKeywords(CONVOCACAO).map((keyword) => keyword.toLowerCase())
    expect(keywords).not.toContain('edital')
    expect(keywords).not.toContain('ordem')
    expect(keywords).not.toContain('síndico')
  })
})

describe('buildAtaContext', () => {
  it('keeps the registry ahead of what was guessed from the document', () => {
    const { keywords } = buildAtaContext({
      condominiumName: 'Condomínio Vila Nova',
      syndicName: 'Eduardo Marchetti',
      convocationText: CONVOCACAO,
    })

    expect(keywords[0]).toBe('Condomínio Vila Nova')
    expect(keywords[1]).toBe('Eduardo Marchetti')
    // O mesmo nome não pode ocupar duas vagas da lista.
    expect(keywords.filter((keyword) => keyword.toLowerCase() === 'eduardo marchetti')).toHaveLength(1)
  })

  it('carries the notice into the prompt, where unstructured context belongs', () => {
    const { prompt } = buildAtaContext({ convocationText: 'ORDEM DO DIA: Reforma da fachada.' })
    expect(prompt).toContain('Convocação: ORDEM DO DIA: Reforma da fachada.')
  })

  it('still works when there is no notice and no registry at all', () => {
    const { keywords, prompt } = buildAtaContext({})
    expect(keywords).toContain('assembleia geral ordinária')
    expect(prompt).toBe('Gravação de assembleia de condomínio em português do Brasil.')
  })
})
