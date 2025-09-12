import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Role } from '@/data/fixtures'

interface RoleProtectedRouteProps {
  children: React.ReactNode
  allowedRoles: Role[]
}

export function RoleProtectedRoute({ children, allowedRoles }: RoleProtectedRouteProps) {
  const { user, userProfile, loading } = useAuth()

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <div className="text-sm text-muted-foreground">Verificando permissões...</div>
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