import { describe, expect, it } from 'vitest'
import { getMaloteTransportOptions } from '../maloteService'

describe('getMaloteTransportOptions', () => {
  it('uses Gmail with mandatory credentials by default', () => {
    expect(getMaloteTransportOptions({ GMAIL_SMTP_USER: 'envio@empresa.com', GMAIL_SMTP_APP_PASSWORD: 'app-password' })).toEqual({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: 'envio@empresa.com', pass: 'app-password' },
    })
  })

  it('allows a local SMTP collector without credentials', () => {
    expect(getMaloteTransportOptions({ MALOTE_SMTP_HOST: '127.0.0.1', MALOTE_SMTP_PORT: '55425', MALOTE_SMTP_SECURE: 'false' })).toEqual({
      host: '127.0.0.1',
      port: 55425,
      secure: false,
    })
  })

  it('rejects an invalid SMTP port', () => {
    expect(() => getMaloteTransportOptions({ MALOTE_SMTP_HOST: '127.0.0.1', MALOTE_SMTP_PORT: 'invalid' })).toThrow('MALOTE_SMTP_PORT')
  })
})
