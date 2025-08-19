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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Eye, Trash2, ChevronUp, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { generateUserColor, getUserInitials } from "@/lib/userColors"

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
  onStatusChange?: (id: string | number, statusId: string) => void
  availableStatuses?: Array<{ id: string; name: string; color: string }>
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
  onStatusChange,
  availableStatuses = [],
  sortField, 
  sortDirection,
  onSort,
  className 
}: TabelaOmniaProps) {
  const renderCellValue = (value: any, key: string, row?: TabelaOmniaRow) => {
    if (key === "status" && row) {
      // Use statusName and statusColor if available, otherwise fallback to mapped status
      if (row.statusName && row.statusColor) {
        // If onStatusChange is provided, make it a dropdown button
        if (onStatusChange && availableStatuses.length > 0) {
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-auto p-0 hover:bg-transparent"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Badge 
                    variant="secondary" 
                    className="text-white font-medium whitespace-nowrap text-[10px] px-2 py-1 min-w-fit cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-1"
                    style={{ backgroundColor: row.statusColor }}
                  >
                    {row.statusName.toUpperCase()}
                    <ChevronDown className="w-3 h-3" />
                  </Badge>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {availableStatuses.map((status) => (
                  <DropdownMenuItem
                    key={status.id}
                    onClick={(e) => {
                      e.stopPropagation()
                      onStatusChange(row.id, status.id)
                    }}
                    className="flex items-center gap-2"
                  >
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: status.color }}
                    />
                    {status.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        }
        
        // Static badge if no onStatusChange
        return (
          <Badge 
            variant="secondary" 
            className="text-white font-medium whitespace-nowrap text-[10px] px-2 py-1 min-w-fit"
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
    
    // Render avatar for secretary and responsible
    if ((key === "secretary" || key === "responsible") && value && row) {
      const user = value
      const userColor = (typeof user.color === 'string' && user.color.trim()) ? user.color : generateUserColor(user.id, user.name)
      const fallbackInitials = getUserInitials(user.name)
      
      return (
        <div className="flex items-center justify-center">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.avatarUrl} alt={user.name} />
            <AvatarFallback 
              className="text-xs text-white font-medium"
              style={{ backgroundColor: userColor }}
            >
              {fallbackInitials}
            </AvatarFallback>
          </Avatar>
        </div>
      )
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
                  column.sortable && "cursor-pointer hover:text-foreground",
                  (column.key === "secretary" || column.key === "responsible") && "text-center"
                )}
                onClick={() => column.sortable && handleSort(column.key)}
              >
                <div className={cn(
                  "flex items-center gap-1",
                  (column.key === "secretary" || column.key === "responsible") && "justify-center"
                )}>
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
                <TableCell 
                  key={`${row.id}-${column.key}`} 
                  className={cn(
                    "text-sm",
                    (column.key === "secretary" || column.key === "responsible") && "text-center"
                  )}
                >
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