import * as React from "react"
import { cn } from "@/lib/utils"
import { Status } from "@/data/types"
import { useCrmStatusStore } from "@/store/crmStatus.store"

export interface CrmStatusBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  statusId: string
  fallbackName?: string
}

function CrmStatusBadge({ className, statusId, fallbackName, ...props }: CrmStatusBadgeProps) {
  const { statuses } = useCrmStatusStore()
  
  const status = statuses.find(s => s.id === statusId)
  const displayName = status?.name || fallbackName || 'Status não encontrado'
  const color = status?.color || '#6b7280'
  
  // Gera classes CSS dinâmicas baseadas na cor
  const dynamicStyle = {
    backgroundColor: color + '20', // 20% de opacidade
    color: color,
    borderColor: color + '40' // 40% de opacidade para a borda
  }
  
  return (
    <div 
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        className
      )} 
      style={dynamicStyle}
      {...props}
    >
      {displayName}
    </div>
  )
}

export { CrmStatusBadge }