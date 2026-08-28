import { describe, expect, it } from 'vitest'
import { getR2Config } from '../r2.js'

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
