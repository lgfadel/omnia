import { Badge } from '@/components/ui/badge'
import { getTranscriptionStatusLabel, type AtaTranscriptionStatus as Status } from '@/lib/ataTranscription'
import { CheckCircle2, CircleAlert, LoaderCircle, Upload } from 'lucide-react'

interface AtaTranscriptionStatusProps {
  status: Status
  isReviewed?: boolean
}

const statusAppearance: Record<Status, { className: string; Icon: typeof Upload; detail?: string }> = {
  uploading: {
    className: 'bg-sky-600',
    Icon: Upload,
    detail: 'O arquivo está sendo enviado de forma segura.',
  },
  queued: {
    className: 'bg-amber-600',
    Icon: LoaderCircle,
    detail: 'Você pode continuar usando o Omnia enquanto processamos a gravação.',
  },
  processing: {
    className: 'bg-violet-600',
    Icon: LoaderCircle,
    detail: 'A gravação está sendo preparada e transcrita em segundo plano.',
  },
  completed: {
    className: 'bg-emerald-600',
    Icon: CheckCircle2,
  },
  failed: {
    className: 'bg-rose-600',
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
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <Badge className={`${className} border-none text-white`}>
        <Icon className={`mr-1.5 h-3.5 w-3.5 ${status === 'queued' || status === 'processing' ? 'animate-spin' : ''}`} />
        {isReviewedTranscription ? 'Revisado' : getTranscriptionStatusLabel(status)}
      </Badge>
      {detail && <p className="text-sm text-muted-foreground">{detail}</p>}
    </div>
  )
}
