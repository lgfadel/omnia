import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface OptimizedCardProps {
  title: string
  children: React.ReactNode
  className?: string
  loading?: boolean
}

// Memoized card component to prevent unnecessary re-renders
export const OptimizedCard = React.memo<OptimizedCardProps>(({ 
  title, 
  children, 
  className,
  loading = false 
}) => {
  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="h-4 bg-muted animate-pulse rounded" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="h-3 bg-muted animate-pulse rounded" />
            <div className="h-3 bg-muted animate-pulse rounded w-3/4" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {children}
      </CardContent>
    </Card>
  )
})

OptimizedCard.displayName = 'OptimizedCard'