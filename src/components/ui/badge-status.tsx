import { Badge } from "@/components/ui/badge"
import { logger } from '@/lib/logging'
import { cn } from "@/lib/utils"

type StatusType = "nao-iniciado" | "em-andamento" | "concluido"

interface BadgeStatusProps {
  status: StatusType
  children: React.ReactNode
  className?: string
}

const statusConfig = {
  "nao-iniciado": {
    className: "bg-status-not-started text-status-not-started-foreground hover:bg-status-not-started/80",
    label: "Não Iniciado"
  },
  "em-andamento": {
    className: "bg-status-in-progress text-status-in-progress-foreground hover:bg-status-in-progress/80",
    label: "Em Andamento"
  },
  "concluido": {
    className: "bg-status-completed text-status-completed-foreground hover:bg-status-completed/80",
    label: "Concluído"
  }
}

export function BadgeStatus({ status, children, className }: BadgeStatusProps) {
  const config = statusConfig[status]
  
  // Fallback se o status não for encontrado
  if (!config) {
    logger.warn(`Status "${status}" não encontrado no statusConfig`)
    return (
      <Badge 
        variant="secondary" 
        className={cn("bg-muted text-muted-foreground whitespace-nowrap text-[10px] px-2 py-1 min-w-fit", className)}
      >
        {children}
      </Badge>
    )
  }
  
  return (
    <Badge 
      variant="secondary" 
      className={cn(config.className, "whitespace-nowrap text-[10px] px-2 py-1 min-w-fit", className)}
    >
      {children}
    </Badge>
  )
}

export function BadgeStatusAmarelo({ children, className }: { children: React.ReactNode, className?: string }) {
  return (
    <BadgeStatus status="nao-iniciado" className={className}>
      {children}
    </BadgeStatus>
  )
}