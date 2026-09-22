import { describe, expect, it, vi } from 'vitest'
import { deleteR2Object, getR2Config, uploadR2Object } from '../r2.js'

function fakeClient() {
  const sent: Array<Record<string, unknown>> = []
  return {
    sent,
    client: { send: vi.fn(async (command: { input: Record<string, unknown> }) => { sent.push(command.input); return {} }) },
  }
}

describe('getR2Config', () => {
  it('requires all server-side R2 credentials', () => {
    expect(() => getR2Config({})).toThrow('R2_ACCOUNT_ID')
  })

  it('builds the Cloudflare S3 endpoint from the account id', () => {
    expect(getR2Config({ R2_ACCOUNT_ID: 'account', R2_BUCKET: 'audio', R2_ACCESS_KEY_ID: 'key', R2_SECRET_ACCESS_KEY: 'secret' })).toMatchObject({
      bucket: 'audio', endpoint: 'https://account.r2.cloudflarestorage.com',
    })
  })
})

describe('uploadR2Object', () => {
  it('stores the body under the requested key with its content type', async () => {
    const { client, sent } = fakeClient()
    const body = Buffer.from('audio')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await uploadR2Object(client as any, 'audio', 'ata/job/file.mp3', body, 'audio/mpeg')
    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({ Bucket: 'audio', Key: 'ata/job/file.mp3', Body: body, ContentType: 'audio/mpeg' })
  })
})

describe('deleteR2Object', () => {
  it('removes the object at the requested key', async () => {
    const { client, sent } = fakeClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await deleteR2Object(client as any, 'audio', 'ata/job/file.m4a')
    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({ Bucket: 'audio', Key: 'ata/job/file.m4a' })
  })
})
