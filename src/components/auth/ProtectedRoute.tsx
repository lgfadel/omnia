import React, { useEffect, useState } from 'react'
import { useAuth } from '@/components/auth/AuthProvider'
import { Navigate, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { supabase } from '@/integrations/supabase/client'

interface ProtectedRouteProps {
  children: React.ReactNode
}

interface DiagnosticResult {
  test: string
  status: 'loading' | 'success' | 'error'
  message: string
}

function DiagnosticPanel() {
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([
    { test: 'Supabase Auth Health', status: 'loading', message: 'Verificando...' },
    { test: 'Auth Session', status: 'loading', message: 'Verificando...' },
    { test: 'LocalStorage', status: 'loading', message: 'Verificando...' }
  ])

  useEffect(() => {
    const runDiagnostics = async () => {
      // Test 1: LocalStorage (fast, no network)
      try {
        localStorage.setItem('__test__', 'test')
        localStorage.removeItem('__test__')
        setDiagnostics(prev => prev.map(d => 
          d.test === 'LocalStorage' 
            ? { ...d, status: 'success', message: 'OK' }
            : d
        ))
      } catch (error) {
        setDiagnostics(prev => prev.map(d => 
          d.test === 'LocalStorage' 
            ? { ...d, status: 'error', message: `Bloqueado: ${String(error)}` }
            : d
        ))
      }

      // Test 2: Supabase Auth Health (with apikey)
      try {
        const healthUrl = `https://elmxwvimjxcswjbrzznq.supabase.co/auth/v1/health`
        const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsbXh3dmltanhjc3dqYnJ6em5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyMDQ1NjIsImV4cCI6MjA3MDc4MDU2Mn0.nkapAcvAok4QNPSlLwkfTEbbj90nXJf3gRvBZauMfqI"
        const response = await fetch(healthUrl, { 
          method: 'GET',
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
          }
        })
        setDiagnostics(prev => prev.map(d => 
          d.test === 'Supabase Auth Health' 
            ? { ...d, status: response.ok ? 'success' : 'error', message: response.ok ? 'OK' : `HTTP ${response.status}` }
            : d
        ))
      } catch (error) {
        setDiagnostics(prev => prev.map(d => 
          d.test === 'Supabase Auth Health' 
            ? { ...d, status: 'error', message: `Erro de rede: ${String(error)}` }
            : d
        ))
      }

      // Test 3: Auth Session (with timeout)
      try {
        const timeoutMs = 4000
        const sessionResult = await Promise.race([
          supabase.auth.getSession(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs))
        ]) as { data: { session: any }, error: any } | Error
        const error = (sessionResult && 'error' in sessionResult) ? sessionResult.error : null
        setDiagnostics(prev => prev.map(d => 
          d.test === 'Auth Session' 
            ? { ...d, status: error ? 'error' : 'success', message: error ? `Erro: ${error.message}` : 'OK' }
            : d
        ))
      } catch (error) {
        setDiagnostics(prev => prev.map(d => 
          d.test === 'Auth Session' 
            ? { ...d, status: 'error', message: error instanceof Error && error.message === 'timeout' ? 'Timeout' : `Erro: ${String(error)}` }
            : d
        ))
      }
    }

    runDiagnostics()
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center max-w-lg mx-auto p-6 border rounded-lg bg-card">
        <div className="text-xl font-semibold mb-4">Diagnóstico de Conectividade</div>
        
        <div className="space-y-3 mb-6">
          {diagnostics.map((diagnostic) => (
            <div key={diagnostic.test} className="flex items-center justify-between p-3 border rounded">
              <div className="text-sm font-medium">{diagnostic.test}</div>
              <div className="flex items-center gap-2">
                {diagnostic.status === 'loading' && (
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                )}
                {diagnostic.status === 'success' && (
                  <div className="w-4 h-4 bg-green-500 rounded-full" />
                )}
                {diagnostic.status === 'error' && (
                  <div className="w-4 h-4 bg-red-500 rounded-full" />
                )}
                <span className="text-sm text-muted-foreground">{diagnostic.message}</span>
              </div>
            </div>
          ))}
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
    return <DiagnosticPanel />
  }

  if (!user) {
    return <Navigate to="/auth" replace />
  }

  return <>{children}</>
}