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
import { Eye, Trash2, ChevronUp, ChevronDown, ChevronRight, MessageCircle, Lock } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { generateUserColor, getUserInitials } from "@/lib/userColors"
import { PriorityBadge } from "@/components/ui/priority-badge"
import { CommentsModal } from "@/components/ui/comments-modal"

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

export interface TabelaOmniaGroupedItem {
  type: 'separator' | 'data'
  statusName: string
  statusColor?: string
  count?: number
  data?: TabelaOmniaRow
}

interface TabelaOmniaProps {
  columns: TabelaOmniaColumn[]
  data: TabelaOmniaRow[] | TabelaOmniaGroupedItem[]
  onView?: (id: string | number) => void
  onDelete?: (id: string | number) => void
  onCommentClick?: (id: string | number, title?: string) => void
  onStatusChange?: (id: string | number, statusId: string) => void
  onResponsibleChange?: (id: string | number, userId: string) => void
  onDueDateClick?: (id: string | number, currentDate?: Date) => void
  onPriorityClick?: (id: string | number, currentPriority?: string) => void
  availableStatuses?: Array<{ id: string; name: string; color: string }>
  availableUsers?: Array<{ id: string; name: string; email: string; avatarUrl?: string; color?: string }>
  sortField?: string
  sortDirection?: "asc" | "desc"
  onSort?: (field: string) => void
  className?: string
  grouped?: boolean
}

export function TabelaOmnia({ 
  columns, 
  data, 
  onView, 
  onDelete, 
  onCommentClick,
  onStatusChange,
  onResponsibleChange,
  onDueDateClick,
  onPriorityClick,
  availableStatuses = [],
  availableUsers = [],
  sortField, 
  sortDirection,
  onSort,
  className,
  grouped = false
}: TabelaOmniaProps) {
  const [commentsModal, setCommentsModal] = useState<{ isOpen: boolean; ticketId: string; ticketTitle?: string }>({ 
    isOpen: false, 
    ticketId: '', 
    ticketTitle: '' 
  })
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({})
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  const handleCommentCountChange = (ticketId: string, newCount: number) => {
    setCommentCounts(prev => ({
      ...prev,
      [ticketId]: newCount
    }))
  }

  const toggleGroup = (statusName: string) => {
    const newCollapsed = new Set(collapsedGroups)
    if (newCollapsed.has(statusName)) {
      newCollapsed.delete(statusName)
    } else {
      newCollapsed.add(statusName)
    }
    setCollapsedGroups(newCollapsed)
  }
  const renderCellValue = (value: any, key: string, row?: TabelaOmniaRow) => {
    // Handle priority column
    if (key === "priority" && value) {
      return (
        <div 
          className="cursor-pointer hover:opacity-80 transition-opacity"
          onClick={(e) => {
            e.stopPropagation()
            if (onPriorityClick && row) {
              onPriorityClick(row.id, value)
            }
          }}
        >
          <PriorityBadge priority={value} />
        </div>
      )
    }
    
    // Handle dueDate column with styling
    if (key === "dueDate") {
      if (!row?.dueDateOriginal && value === '-') {
        return (
          <span 
            className="text-muted-foreground cursor-pointer hover:text-primary transition-colors"
            onClick={(e) => {
              e.stopPropagation()
              if (onDueDateClick) {
                onDueDateClick(row.id)
              }
            }}
          >
            {value}
          </span>
        )
      }
      
      if (row?.dueDateOriginal) {
        const date = new Date(row.dueDateOriginal)
        const now = new Date()
        // Set time to start of day for accurate comparison
        now.setHours(0, 0, 0, 0)
        date.setHours(0, 0, 0, 0)
        const isOverdue = date < now
        
        return (
          <span 
            className={`cursor-pointer hover:underline transition-all ${
              isOverdue ? 'text-destructive font-medium hover:text-destructive/80' : 'hover:text-primary'
            }`}
            onClick={(e) => {
              e.stopPropagation()
              if (onDueDateClick) {
                onDueDateClick(row.id, date)
              }
            }}
          >
            {value}
          </span>
        )
      }
      
      return (
        <span 
          className="cursor-pointer hover:text-primary transition-colors"
          onClick={(e) => {
            e.stopPropagation()
            if (onDueDateClick) {
              onDueDateClick(row.id)
            }
          }}
        >
          {value}
        </span>
      )
    }
    
    // Handle comment count column
    if (key === "commentCount") {
      const updatedCount = commentCounts[String(row.id)]
      const count = updatedCount !== undefined ? updatedCount : (value || 0)
      return (
        <div className="flex items-center justify-center">
          <Button
            variant="ghost"
            size="sm"
            className="h-auto p-1 hover:bg-gray-100"
            onClick={(e) => {
              e.stopPropagation()
              if (onCommentClick) {
                onCommentClick(row.id, row.title || row.name)
              } else {
                setCommentsModal({ 
                  isOpen: true, 
                  ticketId: String(row.id), 
                  ticketTitle: row.title || row.name 
                })
              }
            }}
          >
            <div className="flex items-center gap-1 text-foreground">
              <MessageCircle className="w-3 h-3" />
              <span className="text-xs">{count}</span>
            </div>
          </Button>
        </div>
      )
    }
    
    // Handle statusId column (render using statusName and statusColor)
    if (key === "statusId" && row) {
      // Use statusName and statusColor if available
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
                    className="text-white font-medium whitespace-nowrap text-[10px] px-2 py-1 min-w-fit cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-1 rounded-md"
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
            className="text-white font-medium whitespace-nowrap text-[10px] px-2 py-1 min-w-fit rounded-md"
            style={{ backgroundColor: row.statusColor }}
          >
            {row.statusName.toUpperCase()}
          </Badge>
        )
      }
      
      // Fallback to value if no statusName/statusColor
      return value || "-"
    }
    
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
                    className="text-white font-medium whitespace-nowrap text-[10px] px-2 py-1 min-w-fit cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-1 rounded-md"
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
            className="text-white font-medium whitespace-nowrap text-[10px] px-2 py-1 min-w-fit rounded-md"
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
    
    // Render secretary as badge, responsible as avatar
    if (key === "secretary" && value && row) {
      const user = value
      const userColor = user.color && typeof user.color === 'string' && user.color.trim() !== ''
          ? user.color 
          : generateUserColor(user.id, user.name)
      
      return (
        <div className="flex items-center justify-center">
          <Badge 
            variant="secondary" 
            className="text-white font-medium whitespace-nowrap text-xs px-3 py-2 rounded-md h-8 flex items-center"
            style={{ backgroundColor: userColor }}
          >
            {user.name}
          </Badge>
        </div>
      )
    }
    
    if (key === "responsible" && row) {
      if (!value) {
        // No responsible assigned - show clickable placeholder
        return (
          <div className="flex items-center justify-center">
            {onResponsibleChange && availableUsers.length > 0 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 w-8 p-0 rounded-full border-2 border-dashed border-muted-foreground/30 hover:border-primary/50"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="text-xs text-muted-foreground">+</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center">
                  {availableUsers.map((user) => {
                    const userColor = user.color && typeof user.color === 'string' && user.color.trim() !== ''
                      ? user.color 
                      : generateUserColor(user.id, user.name)
                    const initials = getUserInitials(user.name)
                    return (
                      <DropdownMenuItem
                        key={user.id}
                        onClick={(e) => {
                          e.stopPropagation()
                          onResponsibleChange(row.id, user.id)
                        }}
                        className="flex items-center gap-2"
                      >
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={user.avatarUrl} alt={user.name} />
                          <AvatarFallback 
                            className="text-xs text-white font-medium"
                            style={{ backgroundColor: userColor }}
                          >
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{user.name}</span>
                      </DropdownMenuItem>
                    )
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="h-8 w-8 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
                <span className="text-xs text-muted-foreground">-</span>
              </div>
            )}
          </div>
        )
      }
      
      const user = value
      const userColor = user.color && typeof user.color === 'string' && user.color.trim() !== '' 
        ? user.color 
        : generateUserColor(user.id, user.name)
      const fallbackInitials = getUserInitials(user.name)
      
      return (
        <div className="flex items-center justify-center">
          {onResponsibleChange && availableUsers.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 w-8 p-0 rounded-full hover:ring-2 hover:ring-primary/20"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.avatarUrl} alt={user.name} />
                    <AvatarFallback 
                      className="text-xs text-white font-medium"
                      style={{ backgroundColor: userColor }}
                    >
                      {fallbackInitials}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center">
                {availableUsers.map((availableUser) => {
                  const availableUserColor = availableUser.color && typeof availableUser.color === 'string' && availableUser.color.trim() !== ''
                    ? availableUser.color 
                    : generateUserColor(availableUser.id, availableUser.name)
                  const availableInitials = getUserInitials(availableUser.name)
                  return (
                    <DropdownMenuItem
                      key={availableUser.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        onResponsibleChange(row.id, availableUser.id)
                      }}
                      className={cn(
                        "flex items-center gap-2",
                        availableUser.id === user.id && "bg-muted"
                      )}
                    >
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={availableUser.avatarUrl} alt={availableUser.name} />
                        <AvatarFallback 
                          className="text-xs text-white font-medium"
                          style={{ backgroundColor: availableUserColor }}
                        >
                          {availableInitials}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{availableUser.name}</span>
                      {availableUser.id === user.id && <span className="text-xs text-muted-foreground ml-auto">Atual</span>}
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Avatar className="h-8 w-8">
              <AvatarImage src={user.avatarUrl} alt={user.name} />
              <AvatarFallback 
                className="text-xs text-white font-medium"
                style={{ backgroundColor: userColor }}
              >
                {fallbackInitials}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      )
    }
    
    if (typeof value === "string" || typeof value === "number") {
      return value
    }
    
    // Handle title column
    if (key === "title" && row) {
      return (
        <div className="flex items-center gap-2">
          <span className="truncate">{value?.toString() || "-"}</span>
          {row.isPrivate && (
            <Lock className="w-3 h-3 text-muted-foreground flex-shrink-0" />
          )}
        </div>
      )
    }
    
    return value?.toString() || "-"
  }

  const handleSort = (field: string) => {
    if (onSort) {
      onSort(field)
    }
  }

  return (
    <div className={className}>
      <Table className="table-fixed w-full">
        <TableHeader>
          <TableRow className="border-b">
            {columns.map((column) => (
              <TableHead 
                key={column.key} 
                className={cn(
                  "text-muted-foreground text-xs uppercase tracking-wide py-4 px-6",
                  column.width,
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
            <TableHead className="w-[10%] text-muted-foreground text-xs uppercase tracking-wide py-4 px-6">AÇÕES</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {grouped ? (
            (data as TabelaOmniaGroupedItem[]).map((item, index) => {
              if (item.type === 'separator') {
                return (
                  <TableRow 
                    key={`separator-${index}`} 
                    className="border-none bg-gray-50 hover:bg-gray-100 cursor-pointer"
                    onClick={() => toggleGroup(item.statusName)}
                  >
                    <TableCell 
                      colSpan={columns.length + 1} 
                      className="py-3 px-6"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          {collapsedGroups.has(item.statusName) ? (
                            <ChevronRight className="w-4 h-4 text-gray-500" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-500" />
                          )}
                          <div 
                            className="w-2 h-2 rounded-full" 
                            style={{ backgroundColor: item.statusColor }}
                          />
                          <span className="font-medium text-sm text-gray-700">
                            {item.statusName.toUpperCase()}
                          </span>
                        </div>
                        <span className="text-sm text-gray-500">
                          {item.count}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              }
              
              const row = item.data!
              const currentStatusName = item.statusName || ''
              const isCollapsed = collapsedGroups.has(currentStatusName)
              
              if (isCollapsed) {
                return null
              }
              
              return (
                <TableRow key={row.id} className="hover:bg-gray-50 cursor-pointer h-12 border-b border-gray-100" onClick={() => onView && onView(row.id)}>
                  {columns.map((column) => (
                    <TableCell 
                      key={`${row.id}-${column.key}`} 
                      className={cn(
                        "text-sm py-4 px-6",
                        (column.key === "secretary" || column.key === "responsible") && "text-center"
                      )}
                    >
                      {renderCellValue(row[column.key], column.key, row)}
                    </TableCell>
                  ))}
                  <TableCell onClick={(e) => e.stopPropagation()} className="py-4 px-6">
                    <div className="flex items-center gap-1">
                      {onView && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-gray-100"
                          onClick={() => onView(row.id)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      )}
                      {onDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-gray-100"
                          onClick={() => onDelete(row.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })
          ) : (
            (data as TabelaOmniaRow[]).map((row) => (
              <TableRow key={row.id} className="hover:bg-gray-50 cursor-pointer h-12 border-b border-gray-100" onClick={() => onView && onView(row.id)}>
                {columns.map((column) => (
                  <TableCell 
                    key={`${row.id}-${column.key}`} 
                    className={cn(
                      "text-sm py-4 px-6",
                      (column.key === "secretary" || column.key === "responsible") && "text-center"
                    )}
                  >
                    {renderCellValue(row[column.key], column.key, row)}
                  </TableCell>
                ))}
                <TableCell onClick={(e) => e.stopPropagation()} className="py-4 px-6">
                  <div className="flex items-center gap-1">
                    {onView && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 !text-foreground hover:!text-foreground hover:bg-gray-100"
                        onClick={() => onView(row.id)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    )}
                    {onDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 !text-foreground hover:!text-foreground hover:bg-gray-100"
                        onClick={() => onDelete(row.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      
      {/* Modal de comentários */}
      <CommentsModal
        isOpen={commentsModal.isOpen}
        onClose={() => setCommentsModal({ isOpen: false, ticketId: '', ticketTitle: '' })}
        ticketId={commentsModal.ticketId}
        ticketTitle={commentsModal.ticketTitle}
        onCommentCountChange={(newCount) => handleCommentCountChange(commentsModal.ticketId, newCount)}
      />
    </div>
  )
}