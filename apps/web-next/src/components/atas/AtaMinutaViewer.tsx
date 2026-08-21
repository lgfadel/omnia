import { parseMinutaSections } from '@/lib/ataMinuta'

interface AtaMinutaViewerProps {
  content: string
}

export function AtaMinutaViewer({ content }: AtaMinutaViewerProps) {
  const sections = parseMinutaSections(content)

  if (sections.length === 0) {
    return <p className="text-sm text-muted-foreground">A minuta ainda não tem conteúdo.</p>
  }

  return (
    <div className="space-y-6">
      {sections.map((section, index) => (
        <div key={`${section.title}-${index}`} className="space-y-2">
          {section.title && <h3 className="text-base font-semibold">{section.title}</h3>}
          {section.body.split('\n\n').filter(Boolean).map((paragraph, paragraphIndex) => (
            <p key={paragraphIndex} className="text-sm leading-6 text-foreground/90">{paragraph}</p>
          ))}
        </div>
      ))}
    </div>
  )
}
