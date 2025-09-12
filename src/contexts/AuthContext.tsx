import React, { createContext, useContext, useEffect, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/integrations/supabase/client'
import { UserRef, Role } from '@/data/fixtures'

interface AuthContextType {
  user: User | null
  session: Session | null
  userProfile: UserRef | null
  loading: boolean
  signUp: (email: string, password: string, name?: string) => Promise<{ error: any }>
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error: any }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [userProfile, setUserProfile] = useState<UserRef | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        
        // Fetch profile for authenticated user
        if (session?.user) {
          fetchUserProfile(session.user.id)
        } else {
          setUserProfile(null)
        }
        
        setLoading(false)
      }
    )

    // THEN check for existing session with error handling
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      
      if (session?.user) {
        fetchUserProfile(session.user.id)
      } else {
        setUserProfile(null)
      }
      
      setLoading(false)
    }).catch((error) => {
      console.warn('Auth session check failed:', error)
      // Allow app to continue loading even if auth fails
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const fetchUserProfile = async (userId: string) => {
    try {
      // Try to fetch user from omnia_users table
      const { data: userData, error } = await supabase
        .from('omnia_users')
        .select('id, name, email, roles, avatar_url, color')
        .eq('auth_user_id', userId)
        .single()

      if (!error && userData) {
        setUserProfile({
          id: userData.id,
          name: userData.name,
          email: userData.email,
          roles: userData.roles as Role[],
          avatarUrl: userData.avatar_url,
          color: userData.color || '#3B82F6'
        })
        return
      }

      // If user not found in omnia_users, create a new record
      
      const { data: authUser } = await supabase.auth.getUser()
      if (!authUser?.user) {
        throw new Error('No authenticated user found')
      }

      const newUserData = {
        auth_user_id: userId,
        name: authUser.user.email?.split('@')[0] || 'Usuário',
        email: authUser.user.email || '',
        roles: ['USUARIO'] // Default role as string array
      }

      const { data: createdUser, error: createError } = await supabase
        .from('omnia_users')
        .insert(newUserData)
        .select('id, name, email, roles, avatar_url, color')
        .single()

      if (createError) {
        console.error('Error creating user profile:', createError)
        // Fallback to basic profile
        setUserProfile({
          id: userId,
          name: newUserData.name,
          email: newUserData.email,
          roles: ['USUARIO'] as Role[],
          avatarUrl: null,
          color: '#3B82F6'
        })
        return
      }

      setUserProfile({
        id: createdUser.id,
        name: createdUser.name,
        email: createdUser.email,
        roles: createdUser.roles as Role[],
        avatarUrl: createdUser.avatar_url,
        color: createdUser.color || '#3B82F6'
      })
    } catch (error) {
      console.error('Error in fetchUserProfile:', error)
      // Minimal fallback for auth errors
      const { data: authUser } = await supabase.auth.getUser()
      setUserProfile({
        id: userId,
        name: authUser?.user?.email?.split('@')[0] || 'Usuário',
        email: authUser?.user?.email || '',
        roles: ['USUARIO'] as Role[],
        avatarUrl: null,
        color: '#3B82F6'
      })
    }
  }

  const signUp = async (email: string, password: string, name?: string) => {
    const redirectUrl = `${window.location.origin}/`
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: name ? { name } : {}
      }
    })
    return { error }
  }

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    return { error }
  }

  const signOut = async () => {
    try {
      await supabase.auth.signOut()
    } catch (error) {
      console.error('Error signing out:', error)
    } finally {
      // Always clear local state even if server signout fails
      setSession(null)
      setUser(null)
      setUserProfile(null)
    }
  }

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    })
    return { error }
  }

  const value = {
    user,
    session,
    userProfile,
    loading,
    signUp,
    signIn,
    signOut,
    resetPassword
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}