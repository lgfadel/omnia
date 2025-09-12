import React, { useEffect, useState } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { useAuth } from '@/components/auth/AuthProvider'
import { Role } from '@/data/types'
import { Button } from '@/components/ui/button'

interface RoleProtectedRouteProps {
  children: React.ReactNode
  allowedRoles: Role[]
}

export function RoleProtectedRoute({ children, allowedRoles }: RoleProtectedRouteProps) {
  const { user, userProfile, loading } = useAuth()
  const [showTimeout, setShowTimeout] = useState(false)

  useEffect(() => {
    if (loading || (!user && !userProfile)) {
      // Show timeout message after 7 seconds of loading
      const timeoutId = setTimeout(() => {
        setShowTimeout(true)
      }, 7000)

      return () => clearTimeout(timeoutId)
    } else {
      setShowTimeout(false)
    }
  }, [loading, user, userProfile])

  // Show loading spinner while checking authentication
  if (loading && !showTimeout) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <div className="text-sm text-muted-foreground">Verificando permissões...</div>
        </div>
      </div>
    )
  }

  // Show timeout fallback
  if ((loading || !userProfile) && showTimeout) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-xl font-semibold mb-2">Verificação de permissões demorada</div>
          <div className="text-muted-foreground mb-6">
            A verificação das suas permissões está demorando. Isso pode ser devido a problemas de conectividade.
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

  // Redirect to auth if no user session
  if (!user) {
    return <Navigate to="/auth" replace />
  }

  // Wait for user profile to load - don't redirect immediately
  if (!userProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <div className="text-sm text-muted-foreground">Carregando perfil do usuário...</div>
        </div>
      </div>
    )
  }

  // Check if user has required roles
  const hasPermission = allowedRoles.some(role => 
    userProfile.roles.includes(role)
  )

  if (!hasPermission) {
    return <Navigate to="/access-denied" replace />
  }

  return <>{children}</>
}