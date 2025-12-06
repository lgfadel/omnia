import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Shield, ArrowLeft } from 'lucide-react'

export default function AccessDenied() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Shield className="h-16 w-16 text-destructive" />
          </div>
          <CardTitle className="text-2xl">Acesso Negado</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">
            Você não possui permissão para acessar esta página. Entre em contato com o administrador do sistema para solicitar acesso.
          </p>
          
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Níveis de Acesso:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li><strong>ADMIN:</strong> Acesso total ao sistema</li>
              <li><strong>SECRETARIO:</strong> Gerenciamento de atas</li>
              <li><strong>USUARIO:</strong> Visualização de atas</li>
            </ul>
          </div>

          <Button 
            onClick={() => navigate('/')} 
            className="w-full"
            variant="outline"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar ao Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}