import { describe, expect, it } from 'vitest'
import {
  buildBalanceteCsvImportPreview,
  parseBalancetesCsv,
  parseMesCompetencia,
  planBalanceteCsvUpsert,
} from '../balanceteCsvImport'

describe('balanceteCsvImport', () => {
  describe('parseMesCompetencia', () => {
    it('converte "YYYY-MM" para o formato interno "MM/AAAA"', () => {
      expect(parseMesCompetencia('2026-06')).toBe('06/2026')
    })

    it('retorna null para formato invalido', () => {
      expect(parseMesCompetencia('06/2026')).toBeNull()
      expect(parseMesCompetencia('2026-13')).toBeNull()
      expect(parseMesCompetencia('')).toBeNull()
    })
  })

  describe('parseBalancetesCsv', () => {
    const csv = [
      'nome_condominio,mes_competencia,data_criacao',
      '"CAROLINE","2026-06","2026-07-13T14:56:12-03:00"',
      '"ALPHA MALL","2026-07","2026-08-06T17:01:49-03:00"',
    ].join('\n')

    it('faz parse das linhas validas do CSV', () => {
      const result = parseBalancetesCsv(csv)

      expect(result.errors).toEqual([])
      expect(result.rows).toEqual([
        {
          rowNumber: 1,
          nomeCondominio: 'CAROLINE',
          competencia: '06/2026',
          dataCriacaoIso: '2026-07-13T14:56:12-03:00',
        },
        {
          rowNumber: 2,
          nomeCondominio: 'ALPHA MALL',
          competencia: '07/2026',
          dataCriacaoIso: '2026-08-06T17:01:49-03:00',
        },
      ])
    })

    it('reporta erro por linha quando a competencia e invalida, sem interromper as demais', () => {
      const csvComErro = [
        'nome_condominio,mes_competencia,data_criacao',
        '"CAROLINE","junho/2026","2026-07-13T14:56:12-03:00"',
        '"ALPHA MALL","2026-07","2026-08-06T17:01:49-03:00"',
      ].join('\n')

      const result = parseBalancetesCsv(csvComErro)

      expect(result.rows).toHaveLength(1)
      expect(result.rows[0].nomeCondominio).toBe('ALPHA MALL')
      expect(result.errors).toEqual([
        { rowNumber: 1, message: expect.stringContaining('competência') },
      ])
    })
  })

  describe('buildBalanceteCsvImportPreview', () => {
    const condominiums = [
      { id: 'c1', name: 'CAROLINE' },
      { id: 'c2', name: 'ALPHA MALL' },
    ]

    it('combina parse do CSV com sugestao de condominio por linha', () => {
      const csv = [
        'nome_condominio,mes_competencia,data_criacao',
        '"CAROLINE","2026-06","2026-07-13T14:56:12-03:00"',
        '"CONDOMINIO SEM MATCH XYZ","2026-07","2026-08-06T17:01:49-03:00"',
      ].join('\n')

      const preview = buildBalanceteCsvImportPreview(csv, condominiums)

      expect(preview.parseErrors).toEqual([])
      expect(preview.rows).toEqual([
        {
          rowNumber: 1,
          nomeCondominioCsv: 'CAROLINE',
          competencia: '06/2026',
          dataCriacaoIso: '2026-07-13T14:56:12-03:00',
          condominiumId: 'c1',
          matchScore: 1,
          needsReview: false,
        },
        {
          rowNumber: 2,
          nomeCondominioCsv: 'CONDOMINIO SEM MATCH XYZ',
          competencia: '07/2026',
          dataCriacaoIso: '2026-08-06T17:01:49-03:00',
          condominiumId: null,
          matchScore: 0.125,
          needsReview: true,
        },
      ])
    })

    it('propaga erros de parse sem gerar linha de preview para eles', () => {
      const csv = [
        'nome_condominio,mes_competencia,data_criacao',
        '"CAROLINE","data-invalida","2026-07-13T14:56:12-03:00"',
      ].join('\n')

      const preview = buildBalanceteCsvImportPreview(csv, condominiums)

      expect(preview.rows).toEqual([])
      expect(preview.parseErrors).toHaveLength(1)
    })
  })

  describe('planBalanceteCsvUpsert', () => {
    it('cria balancete recebido para condominio digital sem registro existente', () => {
      const plan = planBalanceteCsvUpsert({
        isDigitalCondominium: true,
        dataCriacaoIso: '2026-08-06T17:01:49-03:00',
        existing: null,
      })

      expect(plan).toEqual({
        action: 'create',
        patch: { received_at: '2026-08-06', digital_prepared_at: '2026-08-06T17:01:49-03:00' },
      })
    })

    it('nao faz nada quando o condominio digital ja esta sincronizado com o CSV', () => {
      const plan = planBalanceteCsvUpsert({
        isDigitalCondominium: true,
        dataCriacaoIso: '2026-08-06T17:01:49-03:00',
        existing: { receivedAt: '2026-08-06', digitalPreparedAt: '2026-08-06T17:01:49-03:00' },
      })

      expect(plan.action).toBe('noop')
    })

    it('cria balancete "aguardando fisico" para condominio fisico sem registro existente', () => {
      const plan = planBalanceteCsvUpsert({
        isDigitalCondominium: false,
        dataCriacaoIso: '2026-08-06T17:01:49-03:00',
        existing: null,
      })

      expect(plan).toEqual({
        action: 'create',
        patch: { received_at: null, digital_prepared_at: '2026-08-06T17:01:49-03:00' },
      })
    })

    it('nunca sobrescreve received_at de um balancete fisico ja recebido', () => {
      const plan = planBalanceteCsvUpsert({
        isDigitalCondominium: false,
        dataCriacaoIso: '2026-08-06T17:01:49-03:00',
        existing: { receivedAt: '2026-07-20', digitalPreparedAt: '2026-07-15T10:00:00-03:00' },
      })

      expect(plan).toEqual({
        action: 'update',
        patch: { digital_prepared_at: '2026-08-06T17:01:49-03:00' },
      })
    })

    it('nao faz nada quando o fisico ja recebido ja tem o mesmo digital_prepared_at', () => {
      const plan = planBalanceteCsvUpsert({
        isDigitalCondominium: false,
        dataCriacaoIso: '2026-07-15T10:00:00-03:00',
        existing: { receivedAt: '2026-07-20', digitalPreparedAt: '2026-07-15T10:00:00-03:00' },
      })

      expect(plan.action).toBe('noop')
    })
  })
})
