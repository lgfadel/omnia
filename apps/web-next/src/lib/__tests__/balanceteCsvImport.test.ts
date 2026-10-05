import { describe, expect, it } from 'vitest'
import {
  buildBalanceteCsvImportPreview,
  classifyBalanceteCsvRow,
  findDuplicateBalanceteKeys,
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
          matchSource: 'exact',
        },
        {
          rowNumber: 2,
          nomeCondominioCsv: 'CONDOMINIO SEM MATCH XYZ',
          competencia: '07/2026',
          dataCriacaoIso: '2026-08-06T17:01:49-03:00',
          condominiumId: null,
          matchScore: 0.125,
          needsReview: true,
          matchSource: 'fuzzy',
        },
      ])
    })

    it('usa aliases memorizados para resolver nomes que o match aproximado nao acharia', () => {
      const csv = [
        'nome_condominio,mes_competencia,data_criacao',
        '"AGUA DA PRATA","2026-08","2026-09-02T10:00:00-03:00"',
      ].join('\n')
      const aliases = new Map([['AGUA DA PRATA', 'c1']])

      const preview = buildBalanceteCsvImportPreview(csv, condominiums, aliases)

      expect(preview.rows[0]).toMatchObject({
        condominiumId: 'c1',
        needsReview: false,
        matchSource: 'alias',
      })
    })

    it('transforma a segunda ocorrencia da mesma chave condominio+competencia em erro de linha', () => {
      const csv = [
        'nome_condominio,mes_competencia,data_criacao',
        '"CAROLINE","2026-06","2026-07-13T14:56:12-03:00"',
        '"ALPHA MALL","2026-06","2026-07-14T10:00:00-03:00"',
        '"caroline","2026-06","2026-07-15T09:00:00-03:00"',
      ].join('\n')

      const preview = buildBalanceteCsvImportPreview(csv, condominiums)

      expect(preview.rows.map((row) => row.rowNumber)).toEqual([1, 2])
      expect(preview.parseErrors).toEqual([
        { rowNumber: 3, message: expect.stringContaining('duplicada') },
      ])
    })

    it('nao trata como duplicadas linhas sem condominio resolvido', () => {
      const csv = [
        'nome_condominio,mes_competencia,data_criacao',
        '"XYZ ABC QWE","2026-06","2026-07-13T14:56:12-03:00"',
        '"XYZ ABC QWE","2026-06","2026-07-14T14:56:12-03:00"',
      ].join('\n')

      const preview = buildBalanceteCsvImportPreview(csv, condominiums)

      expect(preview.rows).toHaveLength(2)
      expect(preview.parseErrors).toEqual([])
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

  describe('findDuplicateBalanceteKeys', () => {
    it('devolve as chaves condominio+competencia repetidas', () => {
      const duplicates = findDuplicateBalanceteKeys([
        { condominiumId: 'c1', competencia: '08/2026' },
        { condominiumId: 'c2', competencia: '08/2026' },
        { condominiumId: 'c1', competencia: '08/2026' },
        { condominiumId: 'c1', competencia: '07/2026' },
      ])

      expect(duplicates).toEqual(['c1::08/2026'])
    })

    it('devolve lista vazia quando nao ha repeticao', () => {
      expect(findDuplicateBalanceteKeys([{ condominiumId: 'c1', competencia: '08/2026' }])).toEqual([])
    })
  })

  describe('classifyBalanceteCsvRow', () => {
    it('mapeia create/update/noop para new/update/unchanged', () => {
      expect(classifyBalanceteCsvRow({ action: 'noop' })).toBe('unchanged')
      expect(
        classifyBalanceteCsvRow({
          action: 'create',
          patch: { received_at: null, digital_prepared_at: '2026-08-06T17:01:49-03:00' },
        })
      ).toBe('new')
      expect(
        classifyBalanceteCsvRow({
          action: 'update',
          patch: { digital_prepared_at: '2026-08-06T17:01:49-03:00' },
        })
      ).toBe('update')
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

    it('reconhece o mesmo instante mesmo com offset diferente (como o banco devolve TIMESTAMPTZ)', () => {
      const digital = planBalanceteCsvUpsert({
        isDigitalCondominium: true,
        dataCriacaoIso: '2026-08-06T17:01:49-03:00',
        existing: { receivedAt: '2026-08-06', digitalPreparedAt: '2026-08-06T20:01:49+00:00' },
      })
      const fisico = planBalanceteCsvUpsert({
        isDigitalCondominium: false,
        dataCriacaoIso: '2026-08-06T17:01:49-03:00',
        existing: { receivedAt: '2026-08-10', digitalPreparedAt: '2026-08-06T20:01:49.000Z' },
      })

      expect(digital.action).toBe('noop')
      expect(fisico.action).toBe('noop')
    })

    it('atualiza quando o instante e realmente diferente', () => {
      const plan = planBalanceteCsvUpsert({
        isDigitalCondominium: false,
        dataCriacaoIso: '2026-08-06T17:01:49-03:00',
        existing: { receivedAt: null, digitalPreparedAt: '2026-08-06T17:01:49+00:00' },
      })

      expect(plan.action).toBe('update')
    })

    it('nunca vira noop quando algum dos timestamps e invalido ou ausente', () => {
      const invalidoNoBanco = planBalanceteCsvUpsert({
        isDigitalCondominium: false,
        dataCriacaoIso: '2026-08-06T17:01:49-03:00',
        existing: { receivedAt: null, digitalPreparedAt: 'lixo' },
      })
      const invalidoNoCsv = planBalanceteCsvUpsert({
        isDigitalCondominium: false,
        dataCriacaoIso: 'lixo',
        existing: { receivedAt: null, digitalPreparedAt: 'lixo' },
      })
      const ausenteNoBanco = planBalanceteCsvUpsert({
        isDigitalCondominium: false,
        dataCriacaoIso: '2026-08-06T17:01:49-03:00',
        existing: { receivedAt: null, digitalPreparedAt: null },
      })

      expect(invalidoNoBanco.action).toBe('update')
      expect(invalidoNoCsv.action).toBe('update')
      expect(ausenteNoBanco.action).toBe('update')
    })

    it('digital com received_at diferente do dia do CSV continua atualizando', () => {
      const plan = planBalanceteCsvUpsert({
        isDigitalCondominium: true,
        dataCriacaoIso: '2026-08-06T17:01:49-03:00',
        existing: { receivedAt: '2026-08-01', digitalPreparedAt: '2026-08-06T20:01:49+00:00' },
      })

      expect(plan).toEqual({
        action: 'update',
        patch: { received_at: '2026-08-06', digital_prepared_at: '2026-08-06T17:01:49-03:00' },
      })
    })
  })
})
