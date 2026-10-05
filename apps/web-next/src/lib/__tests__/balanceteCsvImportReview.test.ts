import { describe, expect, it } from 'vitest'
import type { BalanceteCsvPreviewRow } from '../balanceteCsvImport'
import {
  buildReviewRowViews,
  createReviewRows,
  summarizeReview,
  type BalanceteCsvReviewContext,
} from '../balanceteCsvImportReview'

function previewRow(overrides: Partial<BalanceteCsvPreviewRow> = {}): BalanceteCsvPreviewRow {
  return {
    rowNumber: 1,
    nomeCondominioCsv: 'CAROLINE',
    competencia: '08/2026',
    dataCriacaoIso: '2026-09-02T10:00:00-03:00',
    condominiumId: 'c1',
    matchScore: 1,
    needsReview: false,
    matchSource: 'exact',
    ...overrides,
  }
}

const emptyContext: BalanceteCsvReviewContext = {
  isDigitalCondominium: () => false,
  existingByKey: new Map(),
}

describe('balanceteCsvImportReview', () => {
  describe('createReviewRows', () => {
    it('confirma automaticamente linhas com match confiavel e deixa sugestoes pendentes', () => {
      const rows = createReviewRows([
        previewRow({ rowNumber: 1 }),
        previewRow({ rowNumber: 2, needsReview: true, matchSource: 'fuzzy', matchScore: 0.6 }),
        previewRow({ rowNumber: 3, condominiumId: null, needsReview: true, matchSource: 'fuzzy', matchScore: 0.1 }),
      ])

      expect(rows.map((row) => row.confirmed)).toEqual([true, false, false])
      expect(rows.map((row) => row.selectedCondominiumId)).toEqual(['c1', 'c1', ''])
      expect(rows.every((row) => !row.userConfirmed && !row.ignored)).toBe(true)
    })
  })

  describe('buildReviewRowViews', () => {
    it('classifica em pendente / gravar / em dia', () => {
      const rows = createReviewRows([
        previewRow({ rowNumber: 1, condominiumId: 'c1' }),
        previewRow({ rowNumber: 2, condominiumId: 'c2' }),
        previewRow({ rowNumber: 3, condominiumId: 'c3', needsReview: true, matchSource: 'fuzzy' }),
      ])
      const context: BalanceteCsvReviewContext = {
        isDigitalCondominium: () => false,
        existingByKey: new Map([
          // c2 já está em dia: mesmo instante, offset diferente do CSV.
          ['c2::08/2026', { received_at: null, digital_prepared_at: '2026-09-02T13:00:00+00:00' }],
        ]),
      }

      const views = buildReviewRowViews(rows, context)

      expect(views.map((view) => [view.group, view.status])).toEqual([
        ['write', 'new'],
        ['unchanged', 'unchanged'],
        ['pending', 'new'],
      ])
    })

    it('mantem em pendente a linha sem condominio selecionado', () => {
      const rows = createReviewRows([previewRow({ condominiumId: null, needsReview: true, matchSource: 'fuzzy' })])

      expect(buildReviewRowViews(rows, emptyContext)).toEqual([
        expect.objectContaining({ group: 'pending', status: null }),
      ])
    })

    it('usa o tipo digital/fisico do condominio selecionado', () => {
      const rows = createReviewRows([previewRow({ condominiumId: 'c1' })])
      const digitalContext: BalanceteCsvReviewContext = {
        isDigitalCondominium: (id) => id === 'c1',
        existingByKey: new Map([
          // Digital: received_at precisa bater com o dia do CSV; aqui não bate, então atualiza.
          ['c1::08/2026', { received_at: '2026-08-30', digital_prepared_at: '2026-09-02T13:00:00+00:00' }],
        ]),
      }

      expect(buildReviewRowViews(rows, digitalContext)[0]).toMatchObject({ group: 'write', status: 'update' })
      expect(buildReviewRowViews(rows, emptyContext)[0]).toMatchObject({ group: 'write', status: 'new' })
    })
  })

  describe('summarizeReview', () => {
    it('conta pendentes, gravacoes, em dia e ignoradas; linhas ignoradas nao bloqueiam', () => {
      const rows = createReviewRows([
        previewRow({ rowNumber: 1, condominiumId: 'c1' }),
        previewRow({ rowNumber: 2, condominiumId: 'c2' }),
        previewRow({ rowNumber: 3, condominiumId: 'c3', needsReview: true, matchSource: 'fuzzy' }),
        previewRow({ rowNumber: 4, condominiumId: 'c4', needsReview: true, matchSource: 'fuzzy' }),
      ])
      rows[3].ignored = true
      const views = buildReviewRowViews(rows, {
        isDigitalCondominium: () => false,
        existingByKey: new Map([['c2::08/2026', { received_at: null, digital_prepared_at: '2026-09-02T13:00:00Z' }]]),
      })

      const summary = summarizeReview(views)

      expect(summary.pendingCount).toBe(1)
      expect(summary.writeRows.map((view) => view.row.rowNumber)).toEqual([1])
      expect(summary.unchangedCount).toBe(1)
      expect(summary.ignoredCount).toBe(1)
      expect(summary.duplicateKeys).toEqual([])
    })

    it('so grava alias de linhas confirmadas pelo usuario, inclusive as que ja estavam em dia', () => {
      const rows = createReviewRows([
        previewRow({ rowNumber: 1, nomeCondominioCsv: 'AGUA DA PRATA', condominiumId: 'c1', needsReview: true, matchSource: 'fuzzy' }),
        previewRow({ rowNumber: 2, nomeCondominioCsv: 'ALPHA MALL', condominiumId: 'c2', needsReview: true, matchSource: 'fuzzy' }),
        previewRow({ rowNumber: 3, nomeCondominioCsv: 'CAROLINE', condominiumId: 'c3' }),
      ])
      rows[0] = { ...rows[0], confirmed: true, userConfirmed: true }
      rows[1] = { ...rows[1], confirmed: true, userConfirmed: true }
      const views = buildReviewRowViews(rows, {
        isDigitalCondominium: () => false,
        existingByKey: new Map([['c2::08/2026', { received_at: null, digital_prepared_at: '2026-09-02T13:00:00Z' }]]),
      })

      expect(summarizeReview(views).aliasesToSave).toEqual([
        { condominiumId: 'c1', aliasOriginal: 'AGUA DA PRATA' },
        { condominiumId: 'c2', aliasOriginal: 'ALPHA MALL' },
      ])
    })

    it('nao grava alias de linha ignorada nem de linha ainda nao confirmada', () => {
      const rows = createReviewRows([
        previewRow({ rowNumber: 1, condominiumId: 'c1', needsReview: true, matchSource: 'fuzzy' }),
        previewRow({ rowNumber: 2, condominiumId: 'c2', needsReview: true, matchSource: 'fuzzy' }),
      ])
      rows[0] = { ...rows[0], confirmed: true, userConfirmed: true, ignored: true }

      expect(summarizeReview(buildReviewRowViews(rows, emptyContext)).aliasesToSave).toEqual([])
    })

    it('detecta duas linhas a gravar para o mesmo condominio e competencia', () => {
      const rows = createReviewRows([
        previewRow({ rowNumber: 1, nomeCondominioCsv: 'A', condominiumId: 'c1' }),
        previewRow({ rowNumber: 2, nomeCondominioCsv: 'B', condominiumId: 'c1' }),
      ])

      expect(summarizeReview(buildReviewRowViews(rows, emptyContext)).duplicateKeys).toEqual(['c1::08/2026'])
    })
  })
})
