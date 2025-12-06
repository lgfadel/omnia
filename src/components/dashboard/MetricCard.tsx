import React from 'react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'

export interface MetricCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: LucideIcon
  iconColor?: string
  trend?: {
    value: number
    label: string
    isPositive?: boolean
  }
  className?: string
  loading?: boolean
  onClick?: () => void
}

export const MetricCard = React.memo(function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor = 'text-blue-600',
  trend,
  className,
  loading = false,
  onClick
}: MetricCardProps) {
  const formatValue = (val: string | number): string => {
    if (typeof val === 'number') {
      // Formatar números grandes com separadores
      if (val >= 1000) {
        return val.toLocaleString('pt-BR')
      }
      return val.toString()
    }
    return val
  }

  const getTrendColor = (isPositive?: boolean) => {
    if (isPositive === undefined) return 'text-gray-600'
    return isPositive ? 'text-green-600' : 'text-red-600'
  }

  const getTrendIcon = (isPositive?: boolean) => {
    if (isPositive === undefined) return ''
    return isPositive ? '↗' : '↘'
  }

  if (loading) {
    return (
      <Card className={cn(
        'p-6 hover:shadow-md transition-shadow duration-200',
        onClick && 'cursor-pointer hover:shadow-lg',
        className
      )}>
        <div className="animate-pulse">
          <div className="flex items-center justify-between mb-4">
            <div className="h-4 bg-gray-200 rounded w-24"></div>
            {Icon && (
              <div className="h-6 w-6 bg-gray-200 rounded"></div>
            )}
          </div>
          <div className="h-8 bg-gray-200 rounded w-16 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-20"></div>
        </div>
      </Card>
    )
  }

  return (
    <Card 
      className={cn(
        'p-6 hover:shadow-md transition-shadow duration-200',
        onClick && 'cursor-pointer hover:shadow-lg',
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-600 uppercase tracking-wide">
          {title}
        </h3>
        {Icon && (
          <Icon className={cn('h-6 w-6', iconColor)} />
        )}
      </div>
      
      <div className="space-y-2">
        <div className="text-3xl font-bold text-gray-900">
          {formatValue(value)}
        </div>
        
        {subtitle && (
          <p className="text-sm text-gray-600">
            {subtitle}
          </p>
        )}
        
        {trend && (
          <div className={cn(
            'flex items-center text-sm font-medium',
            getTrendColor(trend.isPositive)
          )}>
            <span className="mr-1">
              {getTrendIcon(trend.isPositive)}
            </span>
            <span>
              {trend.value > 0 ? '+' : ''}{trend.value}% {trend.label}
            </span>
          </div>
        )}
      </div>
    </Card>
  )
})

// Componente específico para métricas de atas
export function AtasMetricCard({
  title,
  value,
  total,
  ...props
}: Omit<MetricCardProps, 'subtitle'> & {
  total?: number
}) {
  const percentage = total && total > 0 ? Math.round((Number(value) / total) * 100) : 0
  const subtitle = total ? `${percentage}% do total (${total})` : undefined
  
  return (
    <MetricCard
      title={title}
      value={value}
      subtitle={subtitle}
      {...props}
    />
  )
}

// Componente específico para métricas de tarefas
export function TarefasMetricCard({
  title,
  value,
  total,
  ...props
}: Omit<MetricCardProps, 'subtitle'> & {
  total?: number
}) {
  const percentage = total && total > 0 ? Math.round((Number(value) / total) * 100) : 0
  const subtitle = total ? `${percentage}% do total (${total})` : undefined
  
  return (
    <MetricCard
      title={title}
      value={value}
      subtitle={subtitle}
      {...props}
    />
  )
}

// Componente para taxa de conclusão
export function TaxaConclusaoCard({
  taxa,
  label = 'Taxa de Conclusão',
  ...props
}: Omit<MetricCardProps, 'title' | 'value' | 'subtitle'> & {
  taxa: number
  label?: string
}) {
  const getColorByTaxa = (taxa: number) => {
    if (taxa >= 80) return 'text-green-600'
    if (taxa >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  return (
    <MetricCard
      title={label}
      value={`${taxa.toFixed(1)}%`}
      iconColor={getColorByTaxa(taxa)}
      {...props}
    />
  )
}

export default MetricCard