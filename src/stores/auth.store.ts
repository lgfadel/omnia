import { create } from 'zustand'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/integrations/supabase/client'
import { UserRef, Role } from '@/data/types'
import { logger } from '@/lib/logging'

interface AuthStore {
  user: User | null
  session: Session | null
  userProfile: UserRef | null
  loading: boolean
  
  // Actions
  signUp: (email: string, password: string, name?: string) => Promise<{ error: any }>
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error: any }>
  initAuth: () => void
  fetchUserProfile: (userId: string) => Promise<void>
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  session: null,
  userProfile: null,
  loading: true,

  initAuth: () => {
    logger.info('Initializing authentication...')
    
    // Safety timeout to prevent infinite loading
    const safetyTimeout = setTimeout(() => {
      logger.warn('Auth initialization timeout - forcing loading=false')
      set({ loading: false })
    }, 10000) // 10 seconds timeout

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        logger.info('Auth state changed:', event)
        clearTimeout(safetyTimeout) // Clear timeout when auth state changes
        
        set({ session, user: session?.user ?? null })
        
        if (session?.user) {
          try {
            await get().fetchUserProfile(session.user.id)
          } catch (error) {
            logger.error('Failed to fetch user profile in auth listener:', error)
          }
        } else {
          set({ userProfile: null })
        }
        
        set({ loading: false })
      }
    )

    // Check for existing session with retry logic
    const checkSession = async (retryCount = 0) => {
      try {
        logger.info('Checking existing session...', { retryCount })
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          throw error
        }

        clearTimeout(safetyTimeout) // Clear timeout on successful session check
        set({ session, user: session?.user ?? null })
        
        if (session?.user) {
          try {
            await get().fetchUserProfile(session.user.id)
          } catch (profileError) {
            logger.error('Failed to fetch user profile:', profileError)
          }
        } else {
          set({ userProfile: null })
        }
        
        set({ loading: false })
        logger.info('Auth initialization completed successfully')
      } catch (error) {
        logger.error('Auth session check failed:', { error, retryCount })
        
        // Retry up to 2 times with exponential backoff
        if (retryCount < 2) {
          const delay = Math.pow(2, retryCount) * 1000 // 1s, 2s
          logger.info(`Retrying session check in ${delay}ms...`)
          setTimeout(() => checkSession(retryCount + 1), delay)
        } else {
          clearTimeout(safetyTimeout)
          set({ loading: false })
          logger.error('Auth initialization failed after retries')
        }
      }
    }

    checkSession()

    // Cleanup function
    return () => {
      clearTimeout(safetyTimeout)
      subscription.unsubscribe()
    }
  },

  fetchUserProfile: async (userId: string) => {
    try {
      // Try to fetch user from omnia_users table
      const { data: userData, error } = await supabase
        .from('omnia_users')
        .select('id, name, email, roles, avatar_url, color')
        .eq('auth_user_id', userId)
        .single()

      if (!error && userData) {
        set({
          userProfile: {
            id: userData.id,
            name: userData.name,
            email: userData.email,
            roles: userData.roles as Role[],
            avatarUrl: userData.avatar_url,
            color: userData.color || '#3B82F6'
          }
        })
        return
      }

      // If user not found, create a new record
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
        logger.error('Error creating user profile:', createError)
        // Fallback to basic profile
        set({
          userProfile: {
            id: userId,
            name: newUserData.name,
            email: newUserData.email,
            roles: ['USUARIO'] as Role[],
            avatarUrl: null,
            color: '#3B82F6'
          }
        })
        return
      }

      set({
        userProfile: {
          id: createdUser.id,
          name: createdUser.name,
          email: createdUser.email,
          roles: createdUser.roles as Role[],
          avatarUrl: createdUser.avatar_url,
          color: createdUser.color || '#3B82F6'
        }
      })
    } catch (error) {
      logger.error('Error in fetchUserProfile:', error)
      // Minimal fallback for auth errors
      const { data: authUser } = await supabase.auth.getUser()
      set({
        userProfile: {
          id: userId,
          name: authUser?.user?.email?.split('@')[0] || 'Usuário',
          email: authUser?.user?.email || '',
          roles: ['USUARIO'] as Role[],
          avatarUrl: null,
          color: '#3B82F6'
        }
      })
    }
  },

  signUp: async (email: string, password: string, name?: string) => {
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
  },

  signIn: async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    return { error }
  },

  signOut: async () => {
    try {
      await supabase.auth.signOut()
    } catch (error) {
      logger.error('Error signing out:', error)
    } finally {
      // Always clear local state even if server signout fails
      set({
        session: null,
        user: null,
        userProfile: null
      })
    }
  },

  resetPassword: async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    })
    return { error }
  }
}))