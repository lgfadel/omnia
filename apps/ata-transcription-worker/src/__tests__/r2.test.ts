import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { describe, expect, it, vi } from 'vitest'
import {
  abortR2Multipart,
  completeR2Multipart,
  createR2Client,
  deleteR2Object,
  getR2Config,
  presignR2Get,
  startR2Multipart,
  uploadR2Part,
} from '../r2.js'

type Sent = { name: string; input: Record<string, unknown> }

function fakeClient(response: Record<string, unknown> = {}) {
  const sent: Sent[] = []
  return {
    sent,
    client: {
      send: vi.fn(async (command: { input: Record<string, unknown>; constructor: { name: string } }) => {
        sent.push({ name: command.constructor.name, input: command.input })
        return response
      }),
    },
  }
}

const credentials = { R2_ACCOUNT_ID: 'account', R2_BUCKET: 'audio', R2_ACCESS_KEY_ID: 'key', R2_SECRET_ACCESS_KEY: 'secret' }

describe('getR2Config', () => {
  it('requires all server-side R2 credentials', () => {
    expect(() => getR2Config({})).toThrow('R2_ACCOUNT_ID')
  })

  it('builds the Cloudflare S3 endpoint from the account id', () => {
    expect(getR2Config(credentials)).toMatchObject({ bucket: 'audio', endpoint: 'https://account.r2.cloudflarestorage.com' })
  })
})

describe('presignR2Get', () => {
  it('signs a time-limited GET for the object so ffmpeg can read ranges of it', async () => {
    const { client, bucket } = createR2Client(credentials)
    const url = new URL(await presignR2Get(client, bucket, 'ata/job/Evidence.m4a', 600))
    // O SDK assina em host virtual (bucket no subdomínio), que o R2 aceita.
    expect(url.host).toBe('audio.account.r2.cloudflarestorage.com')
    expect(url.pathname).toBe('/ata/job/Evidence.m4a')
    expect(url.searchParams.get('X-Amz-Expires')).toBe('600')
    expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('multipart upload of the compacted audio', () => {
  it('starts an upload for the key with its content type', async () => {
    const { client, sent } = fakeClient({ UploadId: 'up-1' })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(startR2Multipart(client as any, 'audio', 'ata/job/a.compacted.mp3', 'audio/mpeg')).resolves.toBe('up-1')
    expect(sent[0]).toMatchObject({ name: 'CreateMultipartUploadCommand', input: { Bucket: 'audio', Key: 'ata/job/a.compacted.mp3', ContentType: 'audio/mpeg' } })
  })

  it('streams each part from disk with its declared length', async () => {
    const { client, sent } = fakeClient({ ETag: '"etag-2"' })
    const path = join(await mkdtemp(join(tmpdir(), 'r2-test-')), 'chunk.mp3')
    await writeFile(path, 'audio')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const part = await uploadR2Part(client as any, 'audio', 'k', 'up-1', 2, path, 5)
    expect(part).toEqual({ PartNumber: 2, ETag: '"etag-2"' })
    expect(sent[0]).toMatchObject({ name: 'UploadPartCommand', input: { UploadId: 'up-1', PartNumber: 2, ContentLength: 5 } })
    expect(sent[0].input.Body).toBeInstanceOf(Readable)
  })

  it('completes with the parts in order', async () => {
    const { client, sent } = fakeClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await completeR2Multipart(client as any, 'audio', 'k', 'up-1', [{ PartNumber: 2, ETag: 'b' }, { PartNumber: 1, ETag: 'a' }])
    expect(sent[0]).toMatchObject({
      name: 'CompleteMultipartUploadCommand',
      input: { UploadId: 'up-1', MultipartUpload: { Parts: [{ PartNumber: 1, ETag: 'a' }, { PartNumber: 2, ETag: 'b' }] } },
    })
  })

  it('aborts an upload that will not be used', async () => {
    const { client, sent } = fakeClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await abortR2Multipart(client as any, 'audio', 'k', 'up-1')
    expect(sent[0]).toMatchObject({ name: 'AbortMultipartUploadCommand', input: { Key: 'k', UploadId: 'up-1' } })
  })
})

describe('deleteR2Object', () => {
  it('removes the object at the requested key', async () => {
    const { client, sent } = fakeClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await deleteR2Object(client as any, 'audio', 'ata/job/file.m4a')
    expect(sent[0]).toMatchObject({ name: 'DeleteObjectCommand', input: { Bucket: 'audio', Key: 'ata/job/file.m4a' } })
  })
})
