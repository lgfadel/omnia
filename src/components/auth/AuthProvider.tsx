import React, { useEffect } from 'react'
import { useAuthStore } from '@/stores/auth.store'

interface AuthProviderProps {
  children: React.ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const initAuth = useAuthStore(state => state.initAuth)

  useEffect(() => {
    const cleanup = initAuth()
    return cleanup
  }, [initAuth])

  return <>{children}</>
}

// Hook to use auth store (replaces useAuth from context)
export function useAuth() {
  return useAuthStore()
}