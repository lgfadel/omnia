import React from 'react'

interface OptimizedListProps<T> {
  items: T[]
  renderItem: (item: T, index: number) => React.ReactNode
  keyExtractor: (item: T) => string
  loading?: boolean
  emptyMessage?: string
  className?: string
}

// Memoized list component for better performance with large datasets
function OptimizedListComponent<T>({ 
  items, 
  renderItem, 
  keyExtractor,
  loading = false,
  emptyMessage = 'Nenhum item encontrado',
  className
}: OptimizedListProps<T>) {
  if (loading) {
    return (
      <div className={className}>
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="p-4 border rounded mb-2">
            <div className="space-y-2">
              <div className="h-4 bg-muted animate-pulse rounded" />
              <div className="h-3 bg-muted animate-pulse rounded w-3/4" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className={`text-center py-8 text-muted-foreground ${className}`}>
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className={className}>
      {items.map((item, index) => (
        <div key={keyExtractor(item)}>
          {renderItem(item, index)}
        </div>
      ))}
    </div>
  )
}

export const OptimizedList = React.memo(OptimizedListComponent) as <T>(props: OptimizedListProps<T>) => JSX.Element

// Set display name for debugging
;(OptimizedList as any).displayName = 'OptimizedList'