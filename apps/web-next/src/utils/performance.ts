// Performance utilities for React optimization

import { useCallback, useMemo, useRef } from 'react'

// Debounce hook for search inputs and API calls
export function useDebounce<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const debounced = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      timeoutRef.current = setTimeout(() => callback(...args), delay)
    },
    [callback, delay]
  )

  return debounced as T
}

// Memoized sort function
export function useSortedData<T>(
  data: T[],
  sortKey: keyof T,
  sortOrder: 'asc' | 'desc' = 'asc'
) {
  return useMemo(() => {
    return [...data].sort((a, b) => {
      const aVal = a[sortKey]
      const bVal = b[sortKey]
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal)
      }
      
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal
      }
      
      return 0
    })
  }, [data, sortKey, sortOrder])
}

// Memoized filter function
export function useFilteredData<T>(
  data: T[],
  filterFn: (item: T) => boolean
) {
  return useMemo(() => {
    return data.filter(filterFn)
  }, [data, filterFn])
}

// Virtual scrolling utility for large lists
export function useVirtualScrolling(
  itemCount: number,
  itemHeight: number,
  containerHeight: number,
  scrollTop: number
) {
  return useMemo(() => {
    const visibleItemCount = Math.ceil(containerHeight / itemHeight)
    const startIndex = Math.floor(scrollTop / itemHeight)
    const endIndex = Math.min(startIndex + visibleItemCount + 1, itemCount)
    
    return {
      startIndex: Math.max(0, startIndex - 1),
      endIndex,
      visibleItemCount,
      totalHeight: itemCount * itemHeight,
      offsetY: startIndex * itemHeight
    }
  }, [itemCount, itemHeight, containerHeight, scrollTop])
}