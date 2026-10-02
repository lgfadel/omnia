import { File } from 'node:buffer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { uploadMinutaDocument } = vi.hoisted(() => ({ uploadMinutaDocument: vi.fn() }))
vi.mock('@/server/ataMinutaService', () => ({ uploadMinutaDocument }))

const { POST } = await import('../route')
const context = { params: Promise.resolve({ ataId: 'ata-1' }) }
const url = 'http://localhost/api/atas/ata-1/minuta/documents/upload'
const pdf = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55, 10, 0, 255])

function request({ fileName = 'convocacao.pdf', kind = 'convocacao', storagePath = 'ata-1/user-1/file-convocacao.pdf', bytes = pdf, auth = true, mime = 'application/pdf' } = {}) {
  const boundary = 'omnia-test-boundary'
  const encoder = new TextEncoder()
  const start = encoder.encode(`--${boundary}\r\nContent-Disposition: form-data; name="kind"\r\n\r\n${kind}\r\n--${boundary}\r\nContent-Disposition: form-data; name="storagePath"\r\n\r\n${storagePath}\r\n--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: ${mime}\r\n\r\n`)
  const end = encoder.encode(`\r\n--${boundary}--\r\n`)
  const body = new Uint8Array(start.byteLength + bytes.byteLength + end.byteLength)
  body.set(start)
  body.set(bytes, start.byteLength)
  body.set(end, start.byteLength + bytes.byteLength)
  return new Request(url, { method: 'POST', body, headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}`, ...(auth ? { Authorization: 'Bearer test-token' } : {}) } })
}

describe('POST small supporting PDF recovery', () => {
  beforeEach(() => {
    vi.stubGlobal('File', File)
    uploadMinutaDocument.mockReset().mockResolvedValue({ id: 'document-1', original_filename: 'convocacao.pdf', kind: 'convocacao', size_bytes: 11 })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('passes the owned path, original filename, kind and exact bytes to the authenticated service', async () => {
    const response = await POST(request(), context)
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ id: 'document-1', size_bytes: 11 })
    expect(uploadMinutaDocument).toHaveBeenCalledWith('Bearer test-token', 'ata-1', { fileName: 'convocacao.pdf', kind: 'convocacao', storagePath: 'ata-1/user-1/file-convocacao.pdf', bytes: pdf })
  })

  it('normalizes an unhelpful browser MIME while preserving the original PDF filename', async () => {
    const response = await POST(request({ fileName: 'Convocação.pdf', mime: 'application/octet-stream' }), context)
    expect(response.status).toBe(200)
    expect(uploadMinutaDocument).toHaveBeenCalledWith('Bearer test-token', 'ata-1', expect.objectContaining({ fileName: 'Convocação.pdf', bytes: pdf }))
  })

  it('refuses requests without bearer auth before parsing their body', async () => {
    const unauthenticated = request({ auth: false })
    const readBody = vi.spyOn(unauthenticated, 'formData')
    const response = await POST(unauthenticated, context)
    expect(response.status).toBe(401)
    expect(readBody).not.toHaveBeenCalled()
    expect(uploadMinutaDocument).not.toHaveBeenCalled()
  })

  it.each([
    { kind: 'invalid' },
    { storagePath: '' },
    { fileName: 'convocacao.txt' },
    { bytes: new Uint8Array() },
  ])('rejects invalid document input %j without calling storage', async (input) => {
    const response = await POST(request(input), context)
    expect(response.status).toBe(400)
    expect(uploadMinutaDocument).not.toHaveBeenCalled()
  })

  it('rejects a multipart request without a file', async () => {
    const body = '--omnia\r\nContent-Disposition: form-data; name="kind"\r\n\r\nconvocacao\r\n--omnia--\r\n'
    const response = await POST(new Request(url, { method: 'POST', body, headers: { Authorization: 'Bearer test-token', 'Content-Type': 'multipart/form-data; boundary=omnia' } }), context)
    expect(response.status).toBe(400)
    expect(uploadMinutaDocument).not.toHaveBeenCalled()
  })

  it('accepts a PDF exactly at the 4 MiB recovery boundary', async () => {
    const response = await POST(request({ bytes: new Uint8Array(4_194_304) }), context)
    expect(response.status).toBe(200)
    expect(uploadMinutaDocument).toHaveBeenCalledWith('Bearer test-token', 'ata-1', expect.objectContaining({ bytes: expect.any(Uint8Array) }))
    expect(uploadMinutaDocument.mock.calls[0][2].bytes).toHaveLength(4_194_304)
  })

  it('rejects a PDF one byte above 4 MiB before invoking the service', async () => {
    const response = await POST(request({ bytes: new Uint8Array(4_194_305) }), context)
    expect(response.status).toBe(413)
    expect(uploadMinutaDocument).not.toHaveBeenCalled()
  })

  it('rejects oversized declared request bodies before reading them', async () => {
    const oversized = request()
    oversized.headers.set('Content-Length', '4259841')
    const response = await POST(oversized, context)
    expect(response.status).toBe(413)
    expect(oversized.bodyUsed).toBe(false)
    expect(uploadMinutaDocument).not.toHaveBeenCalled()
  })

  it('bounds an oversized streaming request without a Content-Length', async () => {
    let cancelled = false
    const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(4_259_841)) }, cancel() { cancelled = true } })
    const streamed = new Request(url, { method: 'POST', body, duplex: 'half', headers: { Authorization: 'Bearer test-token', 'Content-Type': 'multipart/form-data; boundary=omnia' } } as RequestInit)
    const response = await POST(streamed, context)
    expect(response.status).toBe(413)
    expect(cancelled).toBe(true)
    expect(uploadMinutaDocument).not.toHaveBeenCalled()
  })

  it('returns service failures without pretending the document was attached', async () => {
    uploadMinutaDocument.mockRejectedValue(new Error('Você não tem permissão para acessar a minuta desta ata.'))
    const response = await POST(request(), context)
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringContaining('permissão') })
  })

  it('refuses malformed or non-multipart bodies', async () => {
    const response = await POST(new Request(url, { method: 'POST', body: '{}', headers: { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' } }), context)
    expect(response.status).toBe(400)
    expect(uploadMinutaDocument).not.toHaveBeenCalled()
  })
})
