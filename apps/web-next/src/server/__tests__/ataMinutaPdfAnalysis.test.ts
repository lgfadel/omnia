import { PDFDocument } from 'pdf-lib'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { startMinutaPdfAnalysis, readMinutaPdfAnalysis, extractMinutaPdfEvidence, splitMinutaPdf } from '../ataMinutaPdfAnalysis'

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

  it('splits Node buffers downloaded from Storage as well as typed arrays', async () => {
    const widths: number[] = []
    for await (const part of splitMinutaPdf(Buffer.from(await fixture()), 1800)) {
      widths.push(...(await PDFDocument.load(part.bytes)).getPages().map(page => page.getWidth()))
    }
    expect(widths).toEqual([200, 201, 202, 203])
  })

  it('fails explicitly when an individual page cannot fit', async () => {
    const consume = async () => { for await (const part of splitMinutaPdf(await fixture(), 100)) void part }
    await expect(consume()).rejects.toThrow(/página 1.*comprima/i)
  })
})

describe('supporting PDF evidence extraction', () => {
  const options = { originalFilename: 'votos.pdf', model: 'configured-model', reasoningEffort: 'high', apiKey: 'test-key', signal: new AbortController().signal }

  it('uses the configured vision model and returns labeled evidence for the final minuta', async () => {
    const bytes = await fixture()
    const requests: Record<string, unknown>[] = []
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
      requests.push(JSON.parse(init.body as string))
      return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: 'Pauta 1: 10 votos favoráveis; 2 contrários.' }] }] })
    })
    const result = await startMinutaPdfAnalysis({ ...options, part: { bytes } })
    expect(extractMinutaPdfEvidence(result)).toContain('10 votos favoráveis; 2 contrários.')
    expect(requests[0]).toMatchObject({ background: true, store: true, model: 'configured-model', reasoning: { effort: 'high' }, input: [{ role: 'user', content: [expect.objectContaining({ type: 'input_text', text: expect.stringContaining('votos.pdf') }), { type: 'input_file', filename: 'votos.pdf', file_data: `data:application/pdf;base64,${Buffer.from(bytes).toString('base64')}` }] }] })
  })

  it.each([
    { status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' }, output_text: 'Texto cortado' },
    { status: 'completed', output: [{ content: [{ type: 'refusal', refusal: 'Recusado' }] }] },
    { status: 'completed', output: [{ content: [{ type: 'output_text', text: 'Texto parcial' }, { type: 'refusal', refusal: 'Recusado' }] }] },
    { status: 'completed', output: [] },
  ])('refuses incomplete or empty evidence instead of silently dropping pages: %j', async (payload) => {
    expect(() => extractMinutaPdfEvidence(payload)).toThrow(/análise/i)
  })

  it('reports upstream failures with the original filename', async () => {
    vi.stubGlobal('fetch', async () => new Response('rate limited', { status: 429 }))
    await expect(startMinutaPdfAnalysis({ ...options, part: { bytes: await fixture() } })).rejects.toThrow(/429/)
  })

  it('retrieves the accepted response without uploading the PDF again', async () => {
    const requests: Array<{ url: string; init: RequestInit }> = []
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      requests.push({ url, init })
      return Response.json({ id: 'resp_pdf_1', status: 'in_progress', output: [] })
    })
    await expect(readMinutaPdfAnalysis('resp_pdf_1', 'test-key', options.signal)).resolves.toMatchObject({ status: 'in_progress' })
    expect(requests).toEqual([{ url: 'https://api.openai.com/v1/responses/resp_pdf_1', init: { headers: { Authorization: 'Bearer test-key' }, signal: options.signal } }])
  })
})
