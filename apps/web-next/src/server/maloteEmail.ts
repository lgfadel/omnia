import { renderMaloteTemplate } from '@/lib/malotes'

export type MaloteMailTransport = {
  sendMail: (message: {
    to: string
    subject: string
    text: string
    attachments: Array<{ filename: string; content: Buffer; contentType: 'application/pdf' }>
  }) => Promise<{ messageId: string }>
}

type SendMaloteEmailInput = {
  transport: MaloteMailTransport
  recipient: string
  subjectTemplate: string
  bodyTemplate: string
  condominiumName: string
  fileName: string
  fileContents: Buffer
  sentAt: Date
}

export async function sendMaloteEmail(input: SendMaloteEmailInput) {
  const context = {
    condominium: input.condominiumName,
    fileName: input.fileName,
    sentAt: input.sentAt,
  }
  const subject = renderMaloteTemplate(input.subjectTemplate, context)
  const body = renderMaloteTemplate(input.bodyTemplate, context)
  const response = await input.transport.sendMail({
    to: input.recipient,
    subject,
    text: body,
    attachments: [{
      filename: input.fileName,
      content: input.fileContents,
      contentType: 'application/pdf',
    }],
  })

  return { messageId: response.messageId, subject, body }
}
