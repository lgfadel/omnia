import { useState } from 'react'
import { Building2, Users, DollarSign, MessageSquare, MoreHorizontal, Eye, Edit, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { CrmStatusBadge } from '@/components/ui/badge-crm-status'
import { CrmLead } from '@/repositories/crmLeadsRepo.supabase'
import { useRoles } from '@/hooks/useRoles'
import { useNavigate } from 'react-router-dom'
import { useCrmStatusStore } from '@/store/crmStatus.store'

interface CrmLeadsTableProps {
  leads: CrmLead[]
  onEdit: (lead: CrmLead) => void
  onDelete: (id: string) => void
}

export function CrmLeadsTable({ leads, onEdit, onDelete }: CrmLeadsTableProps) {
  const { isAdmin } = useRoles()
  const navigate = useNavigate()
  const { statuses } = useCrmStatusStore()
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  const formatCurrency = (value: number | undefined) => {
    if (!value) return 'Não informado'
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const getStatusName = (statusId: string) => {
    const status = statuses.find(s => s.id === statusId)
    return status?.name || 'Desconhecido'
  }

  const getStatusColor = (statusId: string) => {
    const status = statuses.find(s => s.id === statusId)
    return status?.color || '#6B7280'
  }

  // Agrupar leads por status
  const groupedLeads = leads.reduce((acc, lead) => {
    const statusName = getStatusName(lead.status)
    if (!acc[statusName]) {
      acc[statusName] = []
    }
    acc[statusName].push(lead)
    return acc
  }, {} as Record<string, CrmLead[]>)

  // Ordenar grupos pela ordem dos status
  const sortedStatuses = [...statuses].sort((a, b) => a.order - b.order)
  const sortedGroups = sortedStatuses
    .map(status => ({
      name: status.name,
      color: status.color,
      leads: groupedLeads[status.name] || []
    }))
    .filter(group => group.leads.length > 0)

  const toggleGroup = (groupName: string) => {
    const newCollapsed = new Set(collapsedGroups)
    if (newCollapsed.has(groupName)) {
      newCollapsed.delete(groupName)
    } else {
      newCollapsed.add(groupName)
    }
    setCollapsedGroups(newCollapsed)
  }

  const totalFuncionarios = (lead: CrmLead) => {
    return (lead.numero_funcionarios_proprios || 0) + (lead.numero_funcionarios_terceirizados || 0)
  }

  return (
    <div className="space-y-4">
      {/* Cabeçalho da tabela - aparece apenas uma vez */}
      <div className="bg-card rounded-lg border shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/20">
                <th className="text-left p-4 font-medium text-xs text-muted-foreground uppercase tracking-wider">TÍTULO</th>
                <th className="text-left p-4 font-medium text-xs text-muted-foreground uppercase tracking-wider">DATA CRIAÇÃO</th>
                <th className="text-left p-4 font-medium text-xs text-muted-foreground uppercase tracking-wider">RESPONSÁVEL</th>
                <th className="text-left p-4 font-medium text-xs text-muted-foreground uppercase tracking-wider">SÍNDICO</th>
                <th className="text-left p-4 font-medium text-xs text-muted-foreground uppercase tracking-wider">STATUS</th>
                <th className="text-left p-4 font-medium text-xs text-muted-foreground uppercase tracking-wider">CEP</th>
                <th className="text-left p-4 font-medium text-xs text-muted-foreground uppercase tracking-wider">COMENTÁRIOS</th>
                <th className="text-left p-4 font-medium text-xs text-muted-foreground uppercase tracking-wider">AÇÕES</th>
              </tr>
            </thead>
          </table>
        </div>
      </div>

      {/* Grupos de status */}
      {sortedGroups.map((group) => (
        <div key={group.name} className="bg-card rounded-lg border shadow-sm">
          <button
            onClick={() => toggleGroup(group.name)}
            className="flex items-center justify-between w-full text-left p-4 hover:bg-muted/20 transition-colors border-b"
          >
            <div className="flex items-center gap-3">
              <ChevronDown 
                className={`h-4 w-4 transition-transform ${
                  !collapsedGroups.has(group.name) ? 'rotate-0' : '-rotate-90'
                }`}
              />
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: group.color }}
                />
                <h3 className="text-sm font-medium text-foreground uppercase tracking-wider">
                  {group.name}
                </h3>
                <span className="bg-muted text-muted-foreground text-xs px-2 py-1 rounded-full font-medium">
                  {group.leads.length}
                </span>
              </div>
            </div>
          </button>

          {/* Conteúdo do grupo */}
          {!collapsedGroups.has(group.name) && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <tbody>
                    {group.leads.map((lead, index) => (
                      <tr 
                        key={lead.id} 
                        className={`hover:bg-muted/20 transition-colors ${
                          index !== group.leads.length - 1 ? 'border-b border-border/50' : ''
                        }`}
                      >
                        {/* Título (Cliente) */}
                        <td className="p-4">
                          <div className="space-y-2">
                            <div className="font-medium text-sm text-foreground line-clamp-1">
                              {lead.cliente}
                            </div>
                            {lead.sindico_nome && (
                              <div className="text-xs text-muted-foreground">
                                Síndico: {lead.sindico_nome}
                              </div>
                            )}
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Building2 className="h-3 w-3" />
                                {lead.numero_unidades || 'N/A'} unidades
                              </div>
                              <div className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {totalFuncionarios(lead) || 'N/A'} funcionários
                              </div>
                              <div className="flex items-center gap-1">
                                <DollarSign className="h-3 w-3" />
                                {formatCurrency(lead.valor_proposta)}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Data Criação */}
                        <td className="p-4">
                          <div className="text-sm text-foreground">
                            {new Date(lead.created_at).toLocaleDateString('pt-BR')}
                          </div>
                        </td>

                        {/* Responsável */}
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-medium"
                            >
                              {lead.assigned_to ? 
                                'AS' :
                                'N/A'
                              }
                            </div>
                          </div>
                        </td>

                        {/* Síndico */}
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-medium"
                            >
                              {lead.sindico_nome ? 
                                lead.sindico_nome.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() :
                                'N/A'
                              }
                            </div>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="p-4">
                          <CrmStatusBadge statusId={lead.status} />
                        </td>

                        {/* CEP */}
                        <td className="p-4">
                          <div className="text-sm text-muted-foreground">
                            {lead.cep || 'N/A'}
                          </div>
                        </td>

                        {/* Comentários */}
                        <td className="p-4">
                          <div className="flex items-center gap-1 text-sm">
                            <MessageSquare className="h-4 w-4 text-muted-foreground" />
                            <span>{lead.comment_count || 0}</span>
                          </div>
                        </td>

                        {/* Ações */}
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => navigate(`/crm/${lead.id}`)}
                              className="h-8 w-8 p-0"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => navigate(`/crm/${lead.id}`)}>
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
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>
    )
}