import React, { useEffect, useState } from 'react'
import { useAuth } from '@/components/auth/AuthProvider'
import { Navigate, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth()
  const [showTimeout, setShowTimeout] = useState(false)

  useEffect(() => {
    if (loading) {
      // Show timeout message after 7 seconds of loading
      const timeoutId = setTimeout(() => {
        setShowTimeout(true)
      }, 7000)

      return () => clearTimeout(timeoutId)
    } else {
      setShowTimeout(false)
    }
  }, [loading])

  if (loading && !showTimeout) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <div className="text-sm text-muted-foreground">Carregando aplicação...</div>
        </div>
      </div>
    )
  }

  if (loading && showTimeout) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-xl font-semibold mb-2">Carregamento demorado</div>
          <div className="text-muted-foreground mb-6">
            A aplicação está demorando para carregar. Isso pode ser devido a problemas de conectividade.
          </div>
          <div className="space-y-3">
            <Button onClick={() => window.location.reload()} className="w-full">
              Tentar Novamente
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link to="/auth">Ir para Login</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/auth" replace />
  }

  return <>{children}</>
}