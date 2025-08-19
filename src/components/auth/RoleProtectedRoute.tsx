import React from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Navigate } from 'react-router-dom'
import { Role } from '@/data/fixtures'

interface RoleProtectedRouteProps {
  children: React.ReactNode
  allowedRoles: Role[]
}

export function RoleProtectedRoute({ children, allowedRoles }: RoleProtectedRouteProps) {
  const { user, userProfile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/auth" replace />
  }

  if (!userProfile || !userProfile.roles) {
    return <Navigate to="/access-denied" replace />
  }

  const hasPermission = allowedRoles.some(role => 
    userProfile.roles.includes(role)
  )

  if (!hasPermission) {
    return <Navigate to="/access-denied" replace />
  }

  return <>{children}</>
}