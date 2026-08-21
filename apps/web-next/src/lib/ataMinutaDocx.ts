import { Document, Packer, Paragraph, HeadingLevel } from 'docx'
import { parseMinutaSections } from './ataMinuta'

export async function buildMinutaDocxBlob(title: string, content: string): Promise<Blob> {
  const sections = parseMinutaSections(content)

  const children: Paragraph[] = [
    new Paragraph({ text: title, heading: HeadingLevel.TITLE }),
  ]

  for (const section of sections) {
    if (section.title) children.push(new Paragraph({ text: section.title, heading: HeadingLevel.HEADING_1 }))
    for (const paragraph of section.body.split('\n\n').filter(Boolean)) {
      children.push(new Paragraph({ text: paragraph }))
    }
  }

  const document = new Document({ sections: [{ children }] })
  return Packer.toBlob(document)
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
