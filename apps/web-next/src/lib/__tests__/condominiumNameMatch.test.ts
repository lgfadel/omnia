import { describe, expect, it } from 'vitest'
import { matchCondominiumName, normalizeCondominiumName, type CondominiumMatchCandidate } from '../condominiumNameMatch'

describe('condominiumNameMatch', () => {
  describe('normalizeCondominiumName', () => {
    it('remove acentos, colapsa espacos e converte para maiusculas', () => {
      expect(normalizeCondominiumName('  Felicitã   Residencial  ')).toBe('FELICITA RESIDENCIAL')
    })
  })

  describe('matchCondominiumName', () => {
    const candidates: CondominiumMatchCandidate[] = [
      { id: 'c1', name: 'CAROLINE' },
      { id: 'c2', name: 'CASA BATLLO' },
      { id: 'c3', name: 'MAISON VICTORIA - LONDRINA' },
      { id: 'c4', name: 'MAISON VILLA LOBOS' },
      { id: 'c5', name: 'MAISON MONET' },
      { id: 'c6', name: 'FELICITÁ' },
    ]

    it('faz match exato apos normalizacao (sem revisao)', () => {
      const result = matchCondominiumName('CAROLINE', candidates)
      expect(result).toEqual({
        condominiumId: 'c1',
        matchedName: 'CAROLINE',
        score: 1,
        needsReview: false,
        source: 'exact',
      })
    })

    it('faz match exato ignorando acentos e caixa', () => {
      const result = matchCondominiumName('felicitã', candidates)
      expect(result.condominiumId).toBe('c6')
      expect(result.needsReview).toBe(false)
    })

    it('faz match aproximado de alta confianca quando so muda pontuacao/formatacao', () => {
      const result = matchCondominiumName('MAISON VICTORIA (LONDRINA)', candidates)
      expect(result.condominiumId).toBe('c3')
      expect(result.needsReview).toBe(false)
    })

    it('marca para revisao quando ha candidatos ambiguos e parecidos', () => {
      const result = matchCondominiumName('MAISON', candidates)
      expect(result.needsReview).toBe(true)
    })

    it('nao encontra nenhum candidato razoavel', () => {
      const result = matchCondominiumName('CONDOMINIO TOTALMENTE DIFERENTE XYZ', candidates)
      expect(result.condominiumId).toBeNull()
      expect(result.needsReview).toBe(true)
      expect(result.source).toBe('fuzzy')
    })

    it('marca match aproximado com source "fuzzy"', () => {
      const result = matchCondominiumName('MAISON VICTORIA (LONDRINA)', candidates)
      expect(result.source).toBe('fuzzy')
    })
  })

  describe('matchCondominiumName com aliases memorizados', () => {
    const candidates: CondominiumMatchCandidate[] = [
      { id: 'c1', name: 'ASSOCIAÇÃO RECREATIVA ÁGUA DA PRATA' },
      { id: 'c2', name: 'ASSOCIACAO DOS LOJISTAS DO ALPHA MALL' },
      { id: 'c3', name: 'ALPHA MALL RESIDENCIAL' },
    ]

    it('resolve pelo alias sem pedir revisao, mesmo com nome muito diferente', () => {
      const aliases = new Map([[normalizeCondominiumName('AGUA DA PRATA'), 'c1']])

      const result = matchCondominiumName('Água da  Prata', candidates, aliases)

      expect(result).toEqual({
        condominiumId: 'c1',
        matchedName: 'ASSOCIAÇÃO RECREATIVA ÁGUA DA PRATA',
        score: 1,
        needsReview: false,
        source: 'alias',
      })
    })

    it('alias vence a sugestao aproximada, que apontaria para outro condominio', () => {
      const aliases = new Map([[normalizeCondominiumName('ALPHA MALL'), 'c2']])

      const result = matchCondominiumName('ALPHA MALL', candidates, aliases)

      expect(result.condominiumId).toBe('c2')
      expect(result.source).toBe('alias')
    })

    it('ignora alias de condominio que nao esta entre os candidatos ativos e cai no fluxo normal', () => {
      const aliases = new Map([[normalizeCondominiumName('AGUA DA PRATA'), 'c-inativo']])

      const result = matchCondominiumName('AGUA DA PRATA', candidates, aliases)

      expect(result.source).toBe('fuzzy')
      expect(result.condominiumId).not.toBe('c-inativo')
    })

    it('nome exato continua com source "exact" quando tambem existe alias vazio', () => {
      const result = matchCondominiumName('ALPHA MALL RESIDENCIAL', candidates, new Map())

      expect(result.source).toBe('exact')
      expect(result.condominiumId).toBe('c3')
    })
  })
})
