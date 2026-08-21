import { describe, expect, it, vi } from 'vitest'
import { sendMaloteEmail, type MaloteMailTransport } from '@/server/maloteEmail'

describe('sendMaloteEmail', () => {
  it('sends one PDF email with the rendered content and attachment', async () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: '<gmail-message-id>' })
    const transport: MaloteMailTransport = { sendMail }

    const result = await sendMaloteEmail({
      transport,
      sender: 'envio@loovus.com.br',
      recipient: 'malotes@empresa.com',
      subjectTemplate: 'Malote — {{condominio}} — {{arquivo}}',
      bodyTemplate: 'Arquivo {{arquivo}} enviado em {{data_envio}} para {{condominio}}.',
      condominiumName: 'Condomínio Aurora',
      fileName: 'prestacao.pdf',
      fileContents: Buffer.from('%PDF-1.7 valid'),
      contentType: 'application/pdf',
      sentAt: new Date('2026-08-20T12:00:00-03:00'),
    })

    expect(result).toEqual({
      messageId: '<gmail-message-id>',
      subject: 'Malote — Condomínio Aurora — prestacao.pdf',
      body: 'Arquivo prestacao.pdf enviado em 20/08/2026 para Condomínio Aurora.',
    })
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      from: 'envio@loovus.com.br',
      to: 'malotes@empresa.com',
      subject: 'Malote — Condomínio Aurora — prestacao.pdf',
      text: 'Arquivo prestacao.pdf enviado em 20/08/2026 para Condomínio Aurora.',
      attachments: [expect.objectContaining({ filename: 'prestacao.pdf', content: Buffer.from('%PDF-1.7 valid'), contentType: 'application/pdf' })],
    }))
  })
})
