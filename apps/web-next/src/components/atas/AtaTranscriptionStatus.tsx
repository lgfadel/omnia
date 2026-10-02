import { Badge } from '@/components/ui/badge'
import { getTranscriptionStatusLabel, type AtaTranscriptionStatus as Status } from '@/lib/ataTranscription'
import { CheckCircle2, CircleAlert, LoaderCircle, Upload } from 'lucide-react'

interface AtaTranscriptionStatusProps {
  status: Status
  isReviewed?: boolean
}

const statusAppearance: Record<Status, { className: string; Icon: typeof Upload; detail?: string }> = {
  uploading: {
    className: 'bg-muted/40 text-muted-foreground',
    Icon: Upload,
    detail: 'O arquivo está sendo enviado de forma segura.',
  },
  queued: {
    className: 'bg-muted/40 text-muted-foreground',
    Icon: LoaderCircle,
    detail: 'Você pode continuar usando o Omnia enquanto processamos a gravação.',
  },
  processing: {
    className: 'bg-muted/40 text-muted-foreground',
    Icon: LoaderCircle,
    detail: 'A gravação está sendo preparada e transcrita em segundo plano.',
  },
  completed: {
    className: 'bg-background text-foreground',
    Icon: CheckCircle2,
  },
  failed: {
    className: 'border-destructive/25 bg-destructive/5 text-destructive',
    Icon: CircleAlert,
  },
}

export function AtaTranscriptionStatus({ status, isReviewed = false }: AtaTranscriptionStatusProps) {
  const { className, Icon, detail } = statusAppearance[status]
  // O status do trabalho para em "completed": ele não sabe se alguém já revisou.
  // Sem isto o cabeçalho continuava pedindo revisão de um texto já revisado,
  // contradizendo o próprio painel logo abaixo.
  const isReviewedTranscription = status === 'completed' && isReviewed

  return (
    <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <Badge variant="outline" className={`gap-1.5 py-1 font-normal ${className}`}>
        <Icon aria-hidden="true" className={`h-3.5 w-3.5 ${status === 'queued' || status === 'processing' ? 'motion-safe:animate-spin' : ''}`} />
        {isReviewedTranscription ? 'Revisado' : getTranscriptionStatusLabel(status)}
      </Badge>
      {detail && <p className="text-sm text-muted-foreground">{detail}</p>}
    </div>
  )
}
