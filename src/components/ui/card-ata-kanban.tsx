import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BadgeStatus } from "./badge-status"
import { Button } from "@/components/ui/button"
import { Eye, Trash2, Calendar, Users, FileText } from "lucide-react"
import { cn } from "@/lib/utils"

export interface AtaKanbanData {
  id: string | number
  titulo: string
  descricao?: string
  dataAssembleia: string
  totalParticipantes?: number
  totalDocumentos?: number
  status: "nao-iniciado" | "em-andamento" | "concluido"
  prioridade?: "alta" | "media" | "baixa"
}

interface CardAtaKanbanProps {
  data: AtaKanbanData
  onView?: (id: string | number) => void
  onDelete?: (id: string | number) => void
  className?: string
}

const prioridadeConfig = {
  alta: { color: "bg-destructive", label: "Alta" },
  media: { color: "bg-warning", label: "Média" },
  baixa: { color: "bg-success", label: "Baixa" }
}

export function CardAtaKanban({ 
  data, 
  onView, 
  onDelete, 
  className 
}: CardAtaKanbanProps) {
  const statusLabels = {
    "nao-iniciado": "NÃO INICIADO",
    "em-andamento": "EM ANDAMENTO", 
    "concluido": "CONCLUÍDO"
  }

  return (
    <Card className={cn("hover:shadow-md transition-shadow duration-200", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium text-sm line-clamp-2 flex-1">
            {data.titulo}
          </h3>
          {data.prioridade && (
            <Badge 
              variant="secondary" 
              className={cn(
                "text-xs",
                prioridadeConfig[data.prioridade].color,
                "text-white"
              )}
            >
              {prioridadeConfig[data.prioridade].label}
            </Badge>
          )}
        </div>
        
        {data.descricao && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {data.descricao}
          </p>
        )}
      </CardHeader>
      
      <CardContent className="pt-0 space-y-3">
        {/* Meta Info */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {data.dataAssembleia}
          </div>
          {data.totalParticipantes && (
            <div className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {data.totalParticipantes}
            </div>
          )}
          {data.totalDocumentos && (
            <div className="flex items-center gap-1">
              <FileText className="w-3 h-3" />
              {data.totalDocumentos}
            </div>
          )}
        </div>

        {/* Status */}
        <BadgeStatus status={data.status}>
          {statusLabels[data.status]}
        </BadgeStatus>

        {/* Actions */}
        <div className="flex items-center justify-end gap-1 pt-1">
          {onView && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-primary"
              onClick={() => onView(data.id)}
            >
              <Eye className="w-3 h-3" />
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(data.id)}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}