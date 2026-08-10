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
    })
  })
})
