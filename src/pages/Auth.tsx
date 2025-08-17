import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, FileText } from 'lucide-react'

export default function Auth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  
  const { signIn, resetPassword, user } = useAuth()
  const navigate = useNavigate()

  // Redirect if already authenticated
  useEffect(() => {
    if (user) {
      navigate('/')
    }
  }, [user, navigate])

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await signIn(email, password)
    
    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        setError('Email ou senha incorretos')
      } else if (error.message.includes('Email not confirmed')) {
        setError('Por favor, confirme seu email antes de fazer login')
      } else {
        setError(error.message)
      }
    } else {
      navigate('/')
    }
    
    setLoading(false)
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await resetPassword(email)
    
    if (error) {
      setError('Erro ao enviar email de recuperação. Verifique se o email está correto.')
    } else {
      setMessage('Email de recuperação enviado! Verifique sua caixa de entrada.')
      setShowForgotPassword(false)
    }
    
    setLoading(false)
  }

  if (user) {
    return null // Will redirect via useEffect
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-lg bg-primary/10">
              <FileText className="w-8 h-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-primary">Omnia Atas</CardTitle>
          <CardDescription>
            Sistema de controle de atas de assembleias
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {message && (
            <Alert className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}

          {!showForgotPassword ? (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="login-password">Senha</Label>
                <Input
                  id="login-password"
                  type="password"
                  placeholder="Sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Entrando...' : 'Entrar'}
              </Button>
              
              <div className="text-center">
                <Button 
                  type="button" 
                  variant="link" 
                  className="text-sm text-muted-foreground"
                  onClick={() => setShowForgotPassword(true)}
                >
                  Esqueci minha senha
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-email">Email</Label>
                <Input
                  id="reset-email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Enviando...' : 'Enviar email de recuperação'}
              </Button>
              
              <div className="text-center">
                <Button 
                  type="button" 
                  variant="link" 
                  className="text-sm text-muted-foreground"
                  onClick={() => setShowForgotPassword(false)}
                >
                  Voltar ao login
                </Button>
              </div>
            </form>
          )}


        </CardContent>
      </Card>
    </div>
  )
}