import * as React from "react"
import { cn } from "@/lib/utils"
import { Status } from "@/data/types"
import { useCrmStatusStore } from "@/stores/crmStatus.store"

export interface CrmStatusBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  statusId: string
  fallbackName?: string
}

function CrmStatusBadge({ className, statusId, fallbackName, ...props }: CrmStatusBadgeProps) {
  const { statuses } = useCrmStatusStore()
  
  const status = statuses.find(s => s.id === statusId)
  const displayName = status?.name || fallbackName || 'Status não encontrado'
  const color = status?.color || '#6b7280'
  
  return (
    <div 
      className={cn(
        "flex items-center gap-2",
        className
      )} 
      {...props}
    >
      <div 
        className="w-3 h-3 rounded-full flex-shrink-0" 
        style={{ backgroundColor: color }}
      />
      <span className="text-sm text-foreground truncate">
        {displayName}
      </span>
    </div>
  )
}

export { CrmStatusBadge }