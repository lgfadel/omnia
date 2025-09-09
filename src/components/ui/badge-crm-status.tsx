import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const crmStatusBadgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      status: {
        novo: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200",
        qualificado: "border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200",
        proposta_enviada: "border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-200",
        em_negociacao: "border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-200",
        on_hold: "border-gray-200 bg-gray-50 text-gray-800 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200",
        ganho: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
        perdido: "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
      }
    },
    defaultVariants: {
      status: "novo"
    }
  }
)

export interface CrmStatusBadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof crmStatusBadgeVariants> {
  status: 'novo' | 'qualificado' | 'proposta_enviada' | 'em_negociacao' | 'on_hold' | 'ganho' | 'perdido'
}

const statusLabels = {
  novo: 'Novo',
  qualificado: 'Qualificado',
  proposta_enviada: 'Proposta Enviada',
  em_negociacao: 'Em Negociação',
  on_hold: 'Em Espera',
  ganho: 'Ganho',
  perdido: 'Perdido'
}

function CrmStatusBadge({ className, status, ...props }: CrmStatusBadgeProps) {
  return (
    <div className={cn(crmStatusBadgeVariants({ status }), className)} {...props}>
      {statusLabels[status]}
    </div>
  )
}

export { CrmStatusBadge, crmStatusBadgeVariants }