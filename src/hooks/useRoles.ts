import { useAuth } from '@/components/auth/AuthProvider'
import { Role } from '@/data/types'

export function useRoles() {
  const { userProfile } = useAuth()
  const roles = userProfile?.roles || []

  const hasRole = (role: Role): boolean => {
    return roles.includes(role)
  }

  const hasAnyRole = (rolesToCheck: Role[]): boolean => {
    return rolesToCheck.some(role => roles.includes(role))
  }

  const isAdmin = (): boolean => {
    return hasRole('ADMIN')
  }

  const isSecretario = (): boolean => {
    return hasRole('SECRETARIO')
  }

  const isUsuario = (): boolean => {
    return hasRole('USUARIO')
  }

  const canAccessConfig = (): boolean => {
    return isAdmin()
  }

  return {
    roles,
    hasRole,
    hasAnyRole,
    isAdmin,
    isSecretario,
    isUsuario,
    canAccessConfig
  }
}