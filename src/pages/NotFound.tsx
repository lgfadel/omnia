import { Button } from "@/components/ui/button"
import { useNavigate } from "react-router-dom"
import { Home, ArrowLeft } from "lucide-react"
import { logger } from '@/lib/logging'

export default function NotFound() {
  const navigate = useNavigate()

  const handleGoHome = () => {
    logger.info('User navigated to home from 404 page')
    navigate('/')
  }

  const handleGoBack = () => {
    logger.info('User navigated back from 404 page')
    navigate(-1)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-6 p-8">
        <div className="space-y-2">
          <h1 className="text-9xl font-bold text-muted-foreground">404</h1>
          <h2 className="text-2xl font-semibold text-foreground">Página não encontrada</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            A página que você está procurando não existe ou foi movida para outro local.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button onClick={handleGoBack} variant="outline" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <Button onClick={handleGoHome} className="flex items-center gap-2">
            <Home className="h-4 w-4" />
            Ir para Home
          </Button>
        </div>
      </div>
    </div>
  )
}