import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { BadgeStatus } from "./badge-status"
import { Eye, Trash2, ChevronUp, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

export interface TabelaOmniaColumn {
  key: string
  label: string
  sortable?: boolean
  width?: string
}

export interface TabelaOmniaRow {
  id: string | number
  [key: string]: any
  status?: "nao-iniciado" | "em-andamento" | "concluido"
}

interface TabelaOmniaProps {
  columns: TabelaOmniaColumn[]
  data: TabelaOmniaRow[]
  onView?: (id: string | number) => void
  onDelete?: (id: string | number) => void
  sortField?: string
  sortDirection?: "asc" | "desc"
  onSort?: (field: string) => void
  className?: string
}

export function TabelaOmnia({ 
  columns, 
  data, 
  onView, 
  onDelete, 
  sortField, 
  sortDirection,
  onSort,
  className 
}: TabelaOmniaProps) {
  const renderCellValue = (value: any, key: string, row?: TabelaOmniaRow) => {
    if (key === "status" && row) {
      // Use statusName and statusColor if available, otherwise fallback to mapped status
      if (row.statusName && row.statusColor) {
        return (
          <Badge 
            variant="secondary" 
            className="text-white font-medium"
            style={{ backgroundColor: row.statusColor }}
          >
            {row.statusName.toUpperCase()}
          </Badge>
        )
      }
      
      // Fallback to mapped status logic
      if (value) {
        const statusLabels = {
          "nao-iniciado": "NÃO INICIADO",
          "em-andamento": "EM ANDAMENTO", 
          "concluido": "CONCLUÍDO"
        }
        return (
          <BadgeStatus status={value}>
            {statusLabels[value as keyof typeof statusLabels]}
          </BadgeStatus>
        )
      }
    }
    
    if (typeof value === "string" || typeof value === "number") {
      return value
    }
    
    return value?.toString() || "-"
  }

  const handleSort = (field: string) => {
    if (onSort) {
      onSort(field)
    }
  }

  return (
    <div className={cn("border border-border rounded-lg bg-card", className)}>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            {columns.map((column) => (
              <TableHead 
                key={column.key} 
                className={cn(
                  "font-medium text-muted-foreground text-xs uppercase tracking-wide",
                  column.width && `w-${column.width}`,
                  column.sortable && "cursor-pointer hover:text-foreground"
                )}
                onClick={() => column.sortable && handleSort(column.key)}
              >
                <div className="flex items-center gap-1">
                  {column.label}
                  {column.sortable && sortField === column.key && (
                    sortDirection === "asc" ? (
                      <ChevronUp className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    )
                  )}
                </div>
              </TableHead>
            ))}
            <TableHead className="w-20">AÇÕES</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow key={row.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => onView && onView(row.id)}>
              {columns.map((column) => (
                <TableCell key={`${row.id}-${column.key}`} className="text-sm">
                  {renderCellValue(row[column.key], column.key, row)}
                </TableCell>
              ))}
              <TableCell onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-1">
                  {onView && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-primary"
                      onClick={() => onView(row.id)}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  )}
                  {onDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => onDelete(row.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}