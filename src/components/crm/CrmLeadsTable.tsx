import React, { useState } from 'react'
import { MessageCircle, Eye, Trash, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
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



  return (
    <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="bg-muted/20 border-b">
              <th className="text-left p-2 md:p-4 font-medium text-xs text-muted-foreground uppercase tracking-wider w-[40%]">CONDOMÍNIO</th>
              <th className="text-left p-2 md:p-4 font-medium text-xs text-muted-foreground uppercase tracking-wider w-[15%] hidden sm:table-cell">DATA CRIAÇÃO</th>
              <th className="text-center p-2 md:p-4 font-medium text-xs text-muted-foreground uppercase tracking-wider w-[12%] hidden md:table-cell">RESPONSÁVEL</th>
              <th className="text-left p-2 md:p-4 font-medium text-xs text-muted-foreground uppercase tracking-wider w-[33%]">STATUS</th>
            </tr>
          </thead>
          <tbody>
            {sortedGroups.map((group) => (
              <React.Fragment key={group.name}>
                {/* Linha do grupo */}
                <tr className="bg-muted/10">
                  <td colSpan={4} className="p-0">
                    <button
                       onClick={() => toggleGroup(group.name)}
                       className="flex items-center justify-between w-full text-left p-2 md:p-4 hover:bg-muted/20 transition-colors"
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
                  </td>
                </tr>
                
                {/* Linhas dos leads */}
                {!collapsedGroups.has(group.name) && group.leads.map((lead, index) => (
                  <tr 
                    key={lead.id} 
                    className={`hover:bg-muted/20 transition-colors ${
                      index !== group.leads.length - 1 ? 'border-b border-border/50' : ''
                    }`}
                  >
                     {/* Condomínio */}
                     <td className="p-2 md:p-4 w-[40%]">
                       <div className="font-medium text-sm text-foreground line-clamp-1">
                         {lead.cliente}
                       </div>
                       {/* Mostrar data em mobile */}
                       <div className="text-xs text-muted-foreground mt-1 sm:hidden">
                         {new Date(lead.created_at).toLocaleDateString('pt-BR')}
                       </div>
                     </td>

                     {/* Data Criação */}
                     <td className="p-2 md:p-4 text-sm text-foreground w-[15%] hidden sm:table-cell">
                       {new Date(lead.created_at).toLocaleDateString('pt-BR')}
                     </td>

                     {/* Responsável */}
                     <td className="p-2 md:p-4 w-[12%] hidden md:table-cell">
                       <div className="flex justify-center">
                         <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-medium">
                           {lead.assigned_to ? 'AS' : 'N/A'}
                         </div>
                       </div>
                     </td>

                     {/* Status com ícones à direita */}
                     <td className="p-2 md:p-4 w-[33%]">
                      <div className="flex items-center justify-between">
                        <div>
                          <CrmStatusBadge statusId={lead.status} />
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              // Lógica para comentários
                            }}
                            className="flex items-center gap-1 text-foreground hover:bg-gray-100 p-1 rounded mr-2"
                          >
                            <MessageCircle className="w-3 h-3" />
                            <span className="text-xs">{lead.comment_count || 0}</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/crm/${lead.id}`);
                            }}
                            className="text-muted-foreground hover:text-primary hover:bg-gray-100 p-1 rounded mr-1"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {isAdmin() && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm('Tem certeza que deseja eliminar este lead?')) {
                                  onDelete(lead.id);
                                }
                              }}
                              className="text-muted-foreground hover:text-destructive hover:bg-gray-100 p-1 rounded"
                            >
                              <Trash className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}