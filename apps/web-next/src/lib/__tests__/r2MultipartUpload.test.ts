import { describe, expect, it, vi } from 'vitest'
import { uploadR2Multipart } from '../r2MultipartUpload'

const plan = {
  partSize: 20,
  parts: [
    { partNumber: 1, url: 'https://r2.example/part-1' },
    { partNumber: 2, url: 'https://r2.example/part-2' },
    { partNumber: 3, url: 'https://r2.example/part-3' },
  ],
}

describe('uploadR2Multipart', () => {
  it('slices the file, reports byte progress and returns ordered ETags', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { headers: { ETag: 'etag' } }))
    vi.stubGlobal('fetch', fetchMock)
    const progress = vi.fn()

    const parts = await uploadR2Multipart(new File([new Uint8Array(45)], 'assembleia.m4a', { type: 'audio/mp4' }), plan, progress)

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls.map((call) => {
      const request = (call as unknown as [string, RequestInit])[1]
      return request.body instanceof Blob && request.body.size
    })).toEqual([20, 20, 5])
    expect(parts).toEqual([
      { partNumber: 1, etag: 'etag' },
      { partNumber: 2, etag: 'etag' },
      { partNumber: 3, etag: 'etag' },
    ])
    expect(progress).toHaveBeenLastCalledWith(45, 45)
  })

  it('retries only the failed part', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValue(new Response(null, { headers: { ETag: 'etag' } }))
    vi.stubGlobal('fetch', fetchMock)

    const parts = await uploadR2Multipart(new File([new Uint8Array(20)], 'assembleia.m4a', { type: 'audio/mp4' }), {
      partSize: 20,
      parts: [plan.parts[0]],
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(parts).toEqual([{ partNumber: 1, etag: 'etag' }])
  })

  it('refuses a response that omits the required ETag', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null)))

    await expect(uploadR2Multipart(new File([new Uint8Array(20)], 'assembleia.m4a', { type: 'audio/mp4' }), {
      partSize: 20,
      parts: [plan.parts[0]],
    })).rejects.toThrow('ETag')
  })
})
