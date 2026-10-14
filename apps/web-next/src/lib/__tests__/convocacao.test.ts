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

  it('stops the síndico name at the end of its line', () => {
    // Um nome de pessoa nunca atravessa a quebra de linha. Sem esse limite, o
    // rótulo seguinte ("Data", em maiúscula) virava sobrenome e entrava nas
    // keywords da transcrição.
    const campos = `
EDITAL DE CONVOCAÇÃO
Condomínio: Residencial Jardim das Flores
Síndico: Eduardo Marchetti
Data: 15/10/2026

ORDEM DO DIA
1) Aprovação das contas do exercício anterior;
2) Reforma da fachada e rateio do elevador social;
`
    const context = parseConvocacao(campos, 1)

    expect(context.sindico).toBe('Eduardo Marchetti')
  })

  it('joins a pauta item back together when the PDF wraps it across lines', () => {
    // pdfjs quebra a linha no meio da frase; o marcador numérico não vem
    // seguido de pontuação até a linha seguinte terminar o item.
    const wrapped = `
ASSEMBLEIA GERAL EXTRAORDINÁRIA
para deliberação dos seguintes assuntos em Pauta:
1) DELIBERAÇÃO SOBRE A PADRONIZAÇÃO DA TEMPERATURA DO AR
CONDICIONADO DA ACADEMIA DO CONDOMÍNIO;
`
    const context = parseConvocacao(wrapped, 1)

    expect(context.pautaItems).toEqual([
      'DELIBERAÇÃO SOBRE A PADRONIZAÇÃO DA TEMPERATURA DO AR CONDICIONADO DA ACADEMIA DO CONDOMÍNIO',
    ])
  })

  it('does not count a "-" explanation line under a numbered item as a second pauta item', () => {
    // A convocação da Florais usa "-" para detalhar o item 1, não para listar
    // um item 2 — contar essa linha dobraria a pauta de 1 para 2 itens.
    const withSubDetail = `
para deliberação dos seguintes assuntos em Pauta:
1) DELIBERAÇÃO SOBRE A PADRONIZAÇÃO DA TEMPERATURA DO AR
CONDICIONADO DA ACADEMIA DO CONDOMÍNIO;
- Definição da temperatura padrão para garantir o conforto dos usuários e o adequado
funcionamento do ambiente.
`
    const context = parseConvocacao(withSubDetail, 1)

    expect(context.pautaItems).toEqual([
      'DELIBERAÇÃO SOBRE A PADRONIZAÇÃO DA TEMPERATURA DO AR CONDICIONADO DA ACADEMIA DO CONDOMÍNIO',
    ])
  })

  it('still reads a pauta whose only bullet style is "-"', () => {
    const dashOnly = `
Convocamos os condôminos para a Assembleia Geral Ordinária a ser realizada em 12/09/2026.

ORDEM DO DIA
- Prestação de contas do exercício de 2025
- Reforma da fachada e do hall social
`
    const context = parseConvocacao(dashOnly, 1)

    expect(context.pautaItems).toEqual([
      'Prestação de contas do exercício de 2025',
      'Reforma da fachada e do hall social',
    ])
  })

  it('keeps a wrapped item whose continuation line starts with an ordinal ("1º SECRETÁRIO")', () => {
    // Convocação da AGO Água da Prata: o item 2 quebra em três linhas e a
    // segunda começa com "1º". Lida como marcador, ela virava um item 6 numa
    // pauta de 5 e deixava o item 2 cortado no meio da frase.
    const ago = `
para deliberação dos seguintes assuntos em Pauta:
1) PRESTAÇÃO DE CONTAS DA GESTÃO NOVEMBRO/2025 A SETEMBRO/2026;
- A prestação de contas a ser apresentada estará disponível no aplicativo.
2) ELEIÇÃO DA NOVA DIRETORIA EXECUTIVA (PRESIDENTE, VICE PRESIDENTE,
1º SECRETÁRIO, 2º SECRETÁRIO, 1º TESOUREIRO) E CONSELHO FISCAL PARA A
GESTÃO DE 01/DEZEMBRO/2026 A 30/NOVEMBRO/2028;
3) DELIBERAÇÃO SOBRE A NOVA TAXA ASSOCIATIVA PARA O ANO DE 2026/2027;
4) DELIBERAÇÃO SOBRE A ALTERAÇÃO DO ESTATUTO SOCIAL;
- Art. 65 - Proposta de alteração referente à remuneração do corpo diretivo.
5) DELIBERAÇÃO SOBRE A INCLUSÃO DE NORMAS NO REGIMENTO INTERNO;
- Inclusão de normas para implantação de mecanismos de contenção das águas
pluviais, com a finalidade de evitar danos às vias públicas da Associação.
`
    const context = parseConvocacao(ago, 1)

    expect(context.pautaItems).toEqual([
      'PRESTAÇÃO DE CONTAS DA GESTÃO NOVEMBRO/2025 A SETEMBRO/2026',
      'ELEIÇÃO DA NOVA DIRETORIA EXECUTIVA (PRESIDENTE, VICE PRESIDENTE, 1º SECRETÁRIO, 2º SECRETÁRIO, 1º TESOUREIRO) E CONSELHO FISCAL PARA A GESTÃO DE 01/DEZEMBRO/2026 A 30/NOVEMBRO/2028',
      'DELIBERAÇÃO SOBRE A NOVA TAXA ASSOCIATIVA PARA O ANO DE 2026/2027',
      'DELIBERAÇÃO SOBRE A ALTERAÇÃO DO ESTATUTO SOCIAL',
      'DELIBERAÇÃO SOBRE A INCLUSÃO DE NORMAS NO REGIMENTO INTERNO',
    ])
  })

  it('reads the association and its president when the notice is not from a condomínio', () => {
    // AGO Água da Prata: o nome abre a frase ("A ASSOCIAÇÃO ..., localizada") e
    // quem assina é o Presidente, não um Síndico. A pauta cita "PRESIDENTE,
    // VICE PRESIDENTE" e não pode virar nome de pessoa.
    const ago = `
Associação Recreativa Água da Prata
EDITAL DE CONVOCAÇÃO
A ASSOCIAÇÃO RECREATIVA ÁGUA DA PRATA, localizada na Rod. Alvaro Luiz , Km 26,
Sítio Água da Prata, nesta cidade de Londrina-PR, está CONVOCANDO todos os associados
para a realização da ASSEMBLEIA GERAL ORDINÁRIA que será realizada no dia
08/10/2026 (QUINTA-FEIRA) nas dependências do Salão do Campo Suíço do Neno.
1) PRESTAÇÃO DE CONTAS DA GESTÃO NOVEMBRO/2025 A SETEMBRO/2026;
2) ELEIÇÃO DA NOVA DIRETORIA EXECUTIVA (PRESIDENTE, VICE PRESIDENTE,
1º SECRETÁRIO, 2º SECRETÁRIO, 1º TESOUREIRO) E CONSELHO FISCAL;
Londrina, 28 de setembro de 2026.
Associação Recreativa Água da Prata
Claudio Alves Ferreira
Presidente
`
    const context = parseConvocacao(ago, 1)

    expect(context.condominio).toBe('ASSOCIAÇÃO RECREATIVA ÁGUA DA PRATA')
    expect(context.sindico).toBe('Claudio Alves Ferreira')
  })

  it('does not take a role named in the agenda for the person who signs', () => {
    const semAssinatura = `
A ASSOCIAÇÃO RECREATIVA ÁGUA DA PRATA, localizada na Rod. Alvaro Luiz, Km 26, convoca todos
os associados para a Assembleia Geral Ordinária de 08/10/2026.
2) ELEIÇÃO DA NOVA DIRETORIA EXECUTIVA (PRESIDENTE, VICE PRESIDENTE, 1º SECRETÁRIO);
`
    expect(parseConvocacao(semAssinatura, 1).sindico).toBeUndefined()
  })
})
