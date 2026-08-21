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

  it('finds the condomínio and síndico when the notice has no "Condomínio:"/"Síndico:" labels', () => {
    // "Florais Eco Resort e Residence" não tem CONDOMÍNIO/EDIFÍCIO/RESIDENCIAL
    // no nome, e o síndico só aparece na assinatura, com o rótulo depois do
    // nome — o padrão inverso do que findLabeledName cobre.
    const semRotulo = `
Em observância ao Artigo 1.354-A do Código Civil Brasileiro, o FLORAIS ECO RESORT E
RESIDENCE, localizado na Rua Eurico Hummig, n° 255, está CONVOCANDO a todos para
a Assembleia Geral Extraordinária que será realizada no dia 20/08/2026 às 19h00min.

ORDEM DO DIA
1) Deliberação sobre a padronização da temperatura do ar condicionado da academia

Londrina, 13 de Agosto de 2026.
Florais Eco Resort e Residence
Ronaldo João Zandomenighi
Síndico
`
    const context = parseConvocacao(semRotulo, 1)

    expect(context.condominio).toBe('FLORAIS ECO RESORT E RESIDENCE')
    expect(context.sindico).toBe('Ronaldo João Zandomenighi')
  })

  it('joins a pauta item back together when the PDF wraps it across lines', () => {
    // pdfjs quebra a linha no meio da frase; o marcador numérico não vem
    // seguido de pontuação até a linha seguinte terminar o item.
    const wrapped = `
ASSEMBLEIA GERAL EXTRAORDINÁRIA
para deliberação dos seguintes assuntos em Pauta:
1) DELIBERAÇÃO SOBRE A PADRONIZAÇÃO DA TEMPERATURA DO AR
CONDICIONADO DA ACADEMIA DO CONDOMÍNIO;
- Definição da temperatura padrão para garantir o conforto dos usuários.
`
    const context = parseConvocacao(wrapped, 1)

    expect(context.pautaItems).toEqual([
      'DELIBERAÇÃO SOBRE A PADRONIZAÇÃO DA TEMPERATURA DO AR CONDICIONADO DA ACADEMIA DO CONDOMÍNIO',
      'Definição da temperatura padrão para garantir o conforto dos usuários',
    ])
  })
})
