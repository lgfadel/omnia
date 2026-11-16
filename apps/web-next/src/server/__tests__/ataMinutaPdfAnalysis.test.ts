import { PDFDocument } from 'pdf-lib'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { analyzeMinutaPdf, splitMinutaPdf } from '../ataMinutaPdfAnalysis'

async function fixture() {
  const pdf = await PDFDocument.create()
  for (let index = 0; index < 4; index++) {
    const page = pdf.addPage([200 + index, 300])
    page.drawText(`Votacao ${index + 1}: aprovada por ${index + 10} votos.`)
  }
  return pdf.save({ useObjectStreams: false })
}

afterEach(() => vi.unstubAllGlobals())

describe('PDF parts for visual analysis', () => {
  it('preserves every page in order and keeps each part within the byte budget', async () => {
    const bytes = await fixture()
    const widths: number[] = []
    const ranges: number[][] = []
    for await (const part of splitMinutaPdf(bytes, 1800)) {
      expect(part.bytes.byteLength).toBeLessThanOrEqual(1800)
      const pdf = await PDFDocument.load(part.bytes)
      widths.push(...pdf.getPages().map(page => page.getWidth()))
      expect(part.firstPage).toBeDefined()
      expect(part.lastPage).toBeDefined()
      ranges.push([part.firstPage!, part.lastPage!])
    }
    expect(widths).toEqual([200, 201, 202, 203])
    expect(ranges.length).toBeGreaterThan(1)
    expect(ranges[0][0]).toBe(1)
    expect(ranges.at(-1)?.[1]).toBe(4)
  })

  it('preserves the bytes of a PDF already within the budget', async () => {
    const bytes = await fixture()
    const parts = []
    for await (const part of splitMinutaPdf(bytes)) parts.push(part)
    expect(parts).toHaveLength(1)
    expect(parts[0].bytes).toBe(bytes)
  })

  it('fails explicitly when an individual page cannot fit', async () => {
    const consume = async () => { for await (const part of splitMinutaPdf(await fixture(), 100)) void part }
    await expect(consume()).rejects.toThrow(/página 1.*comprima/i)
  })
})

describe('supporting PDF evidence extraction', () => {
  const options = { originalFilename: 'votos.pdf', model: 'configured-model', reasoningEffort: 'high', apiKey: 'test-key' }

  it('uses the configured vision model and returns labeled evidence for the final minuta', async () => {
    const bytes = await fixture()
    const requests: Record<string, unknown>[] = []
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
      requests.push(JSON.parse(init.body as string))
      return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: 'Pauta 1: 10 votos favoráveis; 2 contrários.' }] }] })
    })
    const result = await analyzeMinutaPdf({ ...options, bytes })
    expect(result.originalFilename).toBe('votos.pdf')
    expect(result.extractedText).toContain('10 votos favoráveis; 2 contrários.')
    expect(result.extractedText).toContain('votos.pdf')
    expect(result).not.toHaveProperty('base64')
    expect(requests[0]).toMatchObject({ model: 'configured-model', reasoning: { effort: 'high' }, input: [{ role: 'user', content: [expect.objectContaining({ type: 'input_text' }), { type: 'input_file', filename: 'votos.pdf', file_data: `data:application/pdf;base64,${Buffer.from(bytes).toString('base64')}` }] }] })
  })

  it.each([
    { status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' }, output_text: 'Texto cortado' },
    { status: 'completed', output: [{ content: [{ type: 'refusal', refusal: 'Recusado' }] }] },
    { status: 'completed', output: [{ content: [{ type: 'output_text', text: 'Texto parcial' }, { type: 'refusal', refusal: 'Recusado' }] }] },
    { status: 'completed', output: [] },
  ])('refuses incomplete or empty evidence instead of silently dropping pages: %j', async (payload) => {
    vi.stubGlobal('fetch', async () => Response.json(payload))
    await expect(analyzeMinutaPdf({ ...options, bytes: await fixture() })).rejects.toThrow(/análise.*votos.pdf/i)
  })

  it('reports upstream failures with the original filename', async () => {
    vi.stubGlobal('fetch', async () => new Response('rate limited', { status: 429 }))
    await expect(analyzeMinutaPdf({ ...options, bytes: await fixture() })).rejects.toThrow(/votos.pdf.*429/)
  })
})
