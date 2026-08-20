import { describe, expect, it } from 'vitest'
import { ConvocacaoSemTextoError, parseConvocacao } from '../convocacao'

const CONVOCACAO = `
CONDOMÍNIO EDIFÍCIO VILA NOVA ESPLANADA
CNPJ 12.345.678/0001-90

EDITAL DE CONVOCAÇÃO
Assembleia Geral Ordinária

O Síndico: Eduardo Marchetti convoca os senhores condôminos para a Assembleia
Geral Ordinária a ser realizada em 12/09/2026, às 19h30, em primeira convocação.

ORDEM DO DIA
a) Prestação de contas do exercício de 2025
b) Reforma da fachada e do hall social
c) Rateio extraordinário do elevador social
d) Eleição do conselho fiscal

Os condôminos inadimplentes não poderão votar, nos termos da convenção.
`

describe('parseConvocacao', () => {
  it('pulls the condominium, the syndic and the date out of the notice', () => {
    const context = parseConvocacao(CONVOCACAO, 1)

    expect(context.condominio).toContain('VILA NOVA ESPLANADA')
    expect(context.sindico).toBe('Eduardo Marchetti')
    expect(context.data).toBe('12/09/2026')
  })

  it('reads the agenda, which is the vocabulary of that specific assembly', () => {
    const context = parseConvocacao(CONVOCACAO, 1)

    expect(context.pautaItems).toEqual([
      'Prestação de contas do exercício de 2025',
      'Reforma da fachada e do hall social',
      'Rateio extraordinário do elevador social',
      'Eleição do conselho fiscal',
    ])
  })

  it('refuses a scanned notice instead of feeding noise to the model', () => {
    // PDF de imagem devolve um punhado de caracteres soltos; contexto ruim é
    // pior que contexto nenhum, porque o modelo acredita nele.
    expect(() => parseConvocacao('  \n \f ', 3)).toThrow(ConvocacaoSemTextoError)
  })

  it('caps the context so the prompt does not carry the whole boilerplate', () => {
    const context = parseConvocacao(CONVOCACAO + 'x'.repeat(9000), 2)
    expect(context.text.length).toBe(4000)
  })
})
