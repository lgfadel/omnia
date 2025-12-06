import { Building2, Users, DollarSign, MessageSquare, MoreHorizontal, Eye, Edit, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { CrmStatusBadge } from '@/components/ui/badge-crm-status'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { CrmLead } from '@/repositories/crmLeadsRepo.supabase'
import { useRoles } from '@/hooks/useRoles'
import { useRouter } from 'next/navigation'

interface CrmLeadCardProps {
  lead: CrmLead
  onEdit: (lead: CrmLead) => void
  onDelete: (id: string) => void
}

export function CrmLeadCard({ lead, onEdit, onDelete }: CrmLeadCardProps) {
  const { isAdmin } = useRoles()
  const router = useRouter()

  const formatCurrency = (value: number | undefined) => {
    if (!value) return 'Não informado'
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const totalFuncionarios = (lead.numero_funcionarios_proprios || 0) + (lead.numero_funcionarios_terceirizados || 0)

  return (
    <Card className="hover:shadow-md transition-shadow duration-200">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-semibold text-lg leading-tight line-clamp-2">
              {lead.cliente}
            </h3>
            {lead.sindico_nome && (
              <p className="text-sm text-muted-foreground mt-1">
                Síndico: {lead.sindico_nome}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 ml-4">
            <CrmStatusBadge statusId={lead.status} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => router.push(`/crm/${lead.id}`)}>
                  <Eye className="mr-2 h-4 w-4" />
                  Visualizar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onEdit(lead)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Editar
                </DropdownMenuItem>
                {isAdmin() && (
                  <DropdownMenuItem
                    onClick={() => onDelete(lead.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Excluir
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="flex items-center gap-2 text-sm">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Unidades:</span>
            <span className="font-medium">{lead.numero_unidades || 'N/A'}</span>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Funcionários:</span>
            <span className="font-medium">{totalFuncionarios || 'N/A'}</span>
          </div>
          
          <div className="flex items-center gap-2 text-sm col-span-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Proposta:</span>
            <span className="font-medium">{formatCurrency(lead.valor_proposta)}</span>
          </div>
        </div>

        {lead.administradora_atual && (
          <div className="mb-3">
            <span className="text-xs text-muted-foreground">Administradora atual:</span>
            <p className="text-sm font-medium">{lead.administradora_atual}</p>
          </div>
        )}

        {lead.observacoes && (
          <div className="mb-3">
            <p className="text-sm text-muted-foreground line-clamp-2">
              {lead.observacoes}
            </p>
          </div>
        )}

        <div className="flex items-center justify-between pt-3 border-t">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MessageSquare className="h-3 w-3" />
            {lead.comment_count || 0} comentários
          </div>
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => router.push(`/crm/${lead.id}`)}
          >
            Ver detalhes
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}