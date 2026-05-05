import { describe, expect, it } from 'vitest'
import {
  parseProtocolImportModelOutput,
  resolveImportedProtocolPage,
  type ImportedProtocolPageContext,
} from '../balanceteProtocolImport'

describe('balanceteProtocolImport', () => {
  describe('parseProtocolImportModelOutput', () => {
    it('extrai o numero do protocolo de um payload JSON valido', () => {
      const result = parseProtocolImportModelOutput(
        JSON.stringify({
          protocol_number: 123,
          confidence: 'high',
          found: true,
        })
      )

      expect(result).toEqual({
        protocolNumber: 123,
        confidence: 'high',
        found: true,
      })
    })

    it('retorna found false quando o modelo informa ausencia de protocolo', () => {
      const result = parseProtocolImportModelOutput(
        JSON.stringify({
          protocol_number: null,
          confidence: 'low',
          found: false,
        })
      )

      expect(result).toEqual({
        protocolNumber: null,
        confidence: 'low',
        found: false,
      })
    })
  })

  describe('resolveImportedProtocolPage', () => {
    const baseContext: ImportedProtocolPageContext = {
      pageNumber: 2,
      detection: {
        found: true,
        confidence: 'high',
        protocolNumber: 45,
      },
      protocolosByNumber: new Map([
        [45, { id: 'prot-45', numero: 45 }],
      ]),
      balancetesByProtocoloId: new Map([
        [
          'prot-45',
          [
            { id: 'bal-1', protocolo_id: 'prot-45' },
          ],
        ],
      ]),
      attachedBalanceteIds: new Set(),
    }

    it('anexa automaticamente quando existe um unico balancete elegivel', () => {
      expect(resolveImportedProtocolPage(baseContext)).toEqual({
        status: 'matched',
        pageNumber: 2,
        protocolNumber: 45,
        protocoloId: 'prot-45',
        balanceteId: 'bal-1',
        attachedBalanceteIds: ['bal-1'],
        confidence: 'high',
      })
    })

    it('marca como protocol_not_found quando o protocolo nao existe no banco', () => {
      expect(
        resolveImportedProtocolPage({
          ...baseContext,
          protocolosByNumber: new Map(),
        })
      ).toEqual({
        status: 'protocol_not_found',
        pageNumber: 2,
        protocolNumber: 45,
        confidence: 'high',
      })
    })

    it('anexa automaticamente em todos os balancetes elegiveis do mesmo protocolo', () => {
      expect(
        resolveImportedProtocolPage({
          ...baseContext,
          balancetesByProtocoloId: new Map([
            [
              'prot-45',
              [
                { id: 'bal-1', protocolo_id: 'prot-45' },
                { id: 'bal-2', protocolo_id: 'prot-45' },
              ],
            ],
          ]),
        })
      ).toEqual({
        status: 'matched',
        pageNumber: 2,
        protocolNumber: 45,
        protocoloId: 'prot-45',
        balanceteId: 'bal-1',
        attachedBalanceteIds: ['bal-1', 'bal-2'],
        confidence: 'high',
      })
    })

    it('marca como already_attached quando o unico balancete elegivel ja possui anexo individual', () => {
      expect(
        resolveImportedProtocolPage({
          ...baseContext,
          attachedBalanceteIds: new Set(['bal-1']),
        })
      ).toEqual({
        status: 'already_attached',
        pageNumber: 2,
        protocolNumber: 45,
        protocoloId: 'prot-45',
        balanceteId: 'bal-1',
        attachedBalanceteIds: ['bal-1'],
        confidence: 'high',
      })
    })

    it('anexa automaticamente quando sobra apenas um balancete elegivel no protocolo', () => {
      expect(
        resolveImportedProtocolPage({
          ...baseContext,
          balancetesByProtocoloId: new Map([
            [
              'prot-45',
              [
                { id: 'bal-1', protocolo_id: 'prot-45' },
                { id: 'bal-2', protocolo_id: 'prot-45' },
              ],
            ],
          ]),
          attachedBalanceteIds: new Set(['bal-1']),
        })
      ).toEqual({
        status: 'matched',
        pageNumber: 2,
        protocolNumber: 45,
        protocoloId: 'prot-45',
        balanceteId: 'bal-2',
        attachedBalanceteIds: ['bal-2'],
        confidence: 'high',
      })
    })

    it('marca como already_attached quando todos os balancetes do protocolo ja possuem anexo individual', () => {
      expect(
        resolveImportedProtocolPage({
          ...baseContext,
          balancetesByProtocoloId: new Map([
            [
              'prot-45',
              [
                { id: 'bal-1', protocolo_id: 'prot-45' },
                { id: 'bal-2', protocolo_id: 'prot-45' },
              ],
            ],
          ]),
          attachedBalanceteIds: new Set(['bal-1', 'bal-2']),
        })
      ).toEqual({
        status: 'already_attached',
        pageNumber: 2,
        protocolNumber: 45,
        protocoloId: 'prot-45',
        balanceteId: 'bal-1',
        attachedBalanceteIds: ['bal-1', 'bal-2'],
        confidence: 'high',
      })
    })

    it('marca como not_found quando o OCR nao encontra protocolo', () => {
      expect(
        resolveImportedProtocolPage({
          ...baseContext,
          detection: {
            found: false,
            confidence: 'low',
            protocolNumber: null,
          },
        })
      ).toEqual({
        status: 'not_found',
        pageNumber: 2,
        confidence: 'low',
      })
    })
  })
})
