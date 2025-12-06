import React, { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, MessageCircle, Eye, Trash2, Edit } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { CrmStatusBadge } from '@/components/ui/badge-crm-status'
import { CrmLead } from '@/repositories/crmLeadsRepo.supabase'
import { useRoles } from '@/hooks/useRoles'
import { useRouter } from 'next/navigation'
import { useCrmStatusStore } from '@/store/crmStatus.store'
import { useCrmLeadsStore } from '@/store/crmLeads.store'
import { useUsersStore } from '@/store/users.store'
import { useCrmOrigensStore } from '@/store/crmOrigens.store'
import { generateUserColor, getUserInitials } from '@/lib/userColors'
import { cn } from '@/lib/utils'
import { logger } from '../../lib/logging';


interface CrmLeadsTableProps {
  leads: CrmLead[]
  onEdit: (lead: CrmLead) => void
  onDelete: (leadId: string) => void
}

export function CrmLeadsTable({ leads, onEdit, onDelete }: CrmLeadsTableProps) {
  const { isAdmin } = useRoles()
  const router = useRouter()
  const { statuses, loadStatuses } = useCrmStatusStore()
  const { updateLead } = useCrmLeadsStore()
  const { users, loadUsers } = useUsersStore()
  const { origens, loadOrigens } = useCrmOrigensStore()
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [updatingResponsibleId, setUpdatingResponsibleId] = useState<string | null>(null)
  const [updatingOrigemId, setUpdatingOrigemId] = useState<string | null>(null)
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null)

  useEffect(() => {
    if (users.length === 0) {
      loadUsers()
    }
  }, [users.length, loadUsers])

  useEffect(() => {
    if (origens.length === 0) {
      loadOrigens()
    }
  }, [origens.length, loadOrigens])

  useEffect(() => {
    if (statuses.length === 0) {
      loadStatuses()
    }
  }, [statuses.length, loadStatuses])

  const handleResponsibleChange = async (leadId: string, userId: string) => {
    setUpdatingResponsibleId(leadId)
    try {
      await updateLead(leadId, { responsavel_negociacao: userId })
    } catch (error) {
      logger.error('Erro ao atualizar responsável:', error)
    } finally {
      setUpdatingResponsibleId(null)
    }
  }

  const handleOrigemChange = async (leadId: string, origemId: string) => {
    setUpdatingOrigemId(leadId)
    try {
      await updateLead(leadId, { origem_id: origemId })
    } catch (error) {
      logger.error('Erro ao atualizar origem:', error)
    } finally {
      setUpdatingOrigemId(null)
    }
  }

  const handleStatusChange = async (leadId: string, statusId: string) => {
    setUpdatingStatusId(leadId)
    try {
      await updateLead(leadId, { status: statusId })
    } catch (error) {
      logger.error('Erro ao atualizar status:', error)
    } finally {
      setUpdatingStatusId(null)
    }
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



  return (
    <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-[800px] w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 font-medium text-gray-900">Condomínio</th>
              <th className="text-left py-3 px-4 font-medium text-gray-900">Data Criação</th>
              <th className="text-left py-3 px-4 font-medium text-gray-900">Responsável</th>
              <th className="text-left py-3 px-4 font-medium text-gray-900">Origem</th>
              <th className="text-left py-3 px-4 font-medium text-gray-900">Status</th>
              <th className="text-left py-3 px-4 font-medium text-gray-900">Ações</th>
            </tr>
          </thead>
          <tbody>
            {sortedGroups.map((group) => (
              <React.Fragment key={group.name}>
                {/* Linha do grupo */}
                <tr className="bg-muted/10">
                  <td colSpan={9} className="p-0">
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
                          <h3 
                            className="text-sm uppercase tracking-wider"
                            style={{ color: group.color }}
                          >
                            {group.name}
                          </h3>
                          <span className="bg-muted text-muted-foreground text-sm px-2 py-1 rounded-full font-medium">
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
                     <td className="p-2 md:p-4 w-[35%]">
                       <div 
                         className="font-medium text-sm text-foreground line-clamp-1 cursor-pointer hover:text-primary transition-colors"
                         onClick={(e) => {
                           e.stopPropagation();
                           router.push(`/crm/${lead.id}`);
                         }}
                       >
                         {lead.cliente}
                       </div>
                       {/* Mostrar data em mobile */}
                       <div className="text-xs text-muted-foreground mt-1 sm:hidden">
                         {new Date(lead.created_at).toLocaleDateString('pt-BR')}
                       </div>
                     </td>

                     {/* Data Criação */}
                     <td className="p-2 md:p-4 text-sm text-foreground w-[12%] hidden sm:table-cell">
                       {new Date(lead.created_at).toLocaleDateString('pt-BR')}
                     </td>

                     {/* Responsável */}
                     <td className="p-2 md:p-4 w-[10%] hidden md:table-cell">
                       <div className="flex justify-center">
                         {lead.responsavel_negociacao && typeof lead.responsavel_negociacao === 'object' ? (
                           <DropdownMenu>
                             <DropdownMenuTrigger asChild>
                               <Button 
                                 variant="ghost" 
                                 size="sm" 
                                 className="h-8 w-8 p-0 rounded-full hover:ring-2 hover:ring-primary/20"
                                 onClick={(e) => e.stopPropagation()}
                                 disabled={updatingResponsibleId === lead.id}
                               >
                                 <Avatar className="h-8 w-8">
                                   <AvatarImage src={lead.responsavel_negociacao.avatar_url} alt={lead.responsavel_negociacao.name} />
                                   <AvatarFallback 
                                     className="text-xs text-white font-medium"
                                     style={{ 
                                       backgroundColor: lead.responsavel_negociacao.color || generateUserColor(lead.responsavel_negociacao.id)
                                     }}
                                   >
                                     {getUserInitials(lead.responsavel_negociacao.name)}
                                   </AvatarFallback>
                                 </Avatar>
                               </Button>
                             </DropdownMenuTrigger>
                             <DropdownMenuContent align="center">
                               {users.map((user) => {
                                 const userColor = user.color && typeof user.color === 'string' && user.color.trim() !== ''
                                   ? user.color 
                                   : generateUserColor(user.id, user.name)
                                 const userInitials = getUserInitials(user.name)
                                 return (
                                   <DropdownMenuItem
                                     key={user.id}
                                     onClick={(e) => {
                                       e.stopPropagation()
                                       handleResponsibleChange(lead.id, user.id)
                                     }}
                                     className={cn(
                                        "flex items-center gap-2",
                                        user.id === (typeof lead.responsavel_negociacao === 'object' ? lead.responsavel_negociacao.id : lead.responsavel_negociacao) && "bg-muted"
                                      )}
                                   >
                                     <Avatar className="h-6 w-6">
                                        <AvatarImage src={user.avatar_url} alt={user.name} />
                                       <AvatarFallback 
                                         className="text-xs text-white font-medium"
                                         style={{ backgroundColor: userColor }}
                                       >
                                         {userInitials}
                                       </AvatarFallback>
                                     </Avatar>
                                     <span className="text-sm">{user.name}</span>
                                      {user.id === (typeof lead.responsavel_negociacao === 'object' ? lead.responsavel_negociacao.id : lead.responsavel_negociacao) && <span className="text-xs text-muted-foreground ml-auto">Atual</span>}
                                   </DropdownMenuItem>
                                 )
                               })}
                             </DropdownMenuContent>
                           </DropdownMenu>
                         ) : (
                           <DropdownMenu>
                             <DropdownMenuTrigger asChild>
                               <Button 
                                 variant="ghost" 
                                 size="sm" 
                                 className="h-8 w-8 p-0 rounded-full hover:ring-2 hover:ring-primary/20"
                                 onClick={(e) => e.stopPropagation()}
                                 disabled={updatingResponsibleId === lead.id}
                               >
                                 <Avatar className="w-8 h-8">
                                   <AvatarFallback className="bg-gray-200 text-gray-600 text-xs font-medium">
                                     N/A
                                   </AvatarFallback>
                                 </Avatar>
                               </Button>
                             </DropdownMenuTrigger>
                             <DropdownMenuContent align="center">
                               {users.map((user) => {
                                 const userColor = user.color && typeof user.color === 'string' && user.color.trim() !== ''
                                   ? user.color 
                                   : generateUserColor(user.id, user.name)
                                 const userInitials = getUserInitials(user.name)
                                 return (
                                   <DropdownMenuItem
                                     key={user.id}
                                     onClick={(e) => {
                                       e.stopPropagation()
                                       handleResponsibleChange(lead.id, user.id)
                                     }}
                                     className="flex items-center gap-2"
                                   >
                                     <Avatar className="h-6 w-6">
                                        <AvatarImage src={user.avatar_url} alt={user.name} />
                                       <AvatarFallback 
                                         className="text-xs text-white font-medium"
                                         style={{ backgroundColor: userColor }}
                                       >
                                         {userInitials}
                                       </AvatarFallback>
                                     </Avatar>
                                     <span className="text-sm">{user.name}</span>
                                   </DropdownMenuItem>
                                 )
                               })}
                             </DropdownMenuContent>
                           </DropdownMenu>
                         )}
                       </div>
                     </td>

                     {/* Origem */}
                     <td className="p-2 md:p-4 w-[13%]">
                       <div className="flex items-center gap-2">
                         {updatingOrigemId === lead.id ? (
                           <div className="flex items-center gap-2 opacity-50">
                             <div className="w-3 h-3 rounded-full bg-gray-300 flex-shrink-0 animate-pulse" />
                             <span className="text-sm text-foreground">Atualizando...</span>
                           </div>
                         ) : (
                           <DropdownMenu>
                             <DropdownMenuTrigger asChild>
                               <Button
                                 variant="ghost"
                                 size="sm"
                                 className="h-auto p-1 hover:bg-gray-100 flex items-center gap-2"
                                 onClick={(e) => e.stopPropagation()}
                               >
                                 <div 
                                   className="w-3 h-3 rounded-full flex-shrink-0" 
                                   style={{ backgroundColor: lead.origem?.color || '#d1d5db' }}
                                 />
                                 <span className="text-sm text-foreground truncate">
                                   {lead.origem?.name || 'N/A'}
                                 </span>
                                 <ChevronDown className="h-3 w-3 text-gray-400 flex-shrink-0" />
                               </Button>
                             </DropdownMenuTrigger>
                             <DropdownMenuContent align="start" className="w-48">
                               {origens.map((origem) => {
                                 const isSelected = lead.origem?.id === origem.id
                                 return (
                                   <DropdownMenuItem
                                     key={origem.id}
                                     onClick={(e) => {
                                       e.stopPropagation()
                                       if (!isSelected) {
                                         handleOrigemChange(lead.id, origem.id)
                                       }
                                     }}
                                     className={cn(
                                       "flex items-center gap-2",
                                       isSelected && "bg-gray-100"
                                     )}
                                   >
                                     <div 
                                       className="w-3 h-3 rounded-full flex-shrink-0" 
                                       style={{ backgroundColor: origem.color }}
                                     />
                                     <span className="text-sm">{origem.name}</span>
                                   </DropdownMenuItem>
                                 )
                               })}
                             </DropdownMenuContent>
                           </DropdownMenu>
                         )}
                       </div>
                     </td>

                     {/* Status */}
                     <td className="p-2 md:p-4 w-[18%]">
                       <div onClick={(e) => e.stopPropagation()}>
                         {updatingStatusId === lead.id ? (
                           <div className="flex items-center gap-2 px-3 py-1 rounded-full text-sm bg-gray-100">
                             <div className="w-3 h-3 rounded-full bg-gray-400 animate-pulse" />
                             <span>Atualizando...</span>
                           </div>
                         ) : (
                           <DropdownMenu>
                             <DropdownMenuTrigger asChild>
                               <Button 
                                 variant="ghost" 
                                 className="h-auto p-0 hover:bg-transparent"
                                 onClick={(e) => e.stopPropagation()}
                               >
                                 <div className="flex items-center gap-2 px-3 py-1 rounded-full text-sm cursor-pointer hover:bg-gray-50 transition-colors">
                                    <div 
                                      className="w-3 h-3 rounded-full flex-shrink-0" 
                                      style={{ backgroundColor: statuses.find(s => s.id === lead.status)?.color || '#6b7280' }}
                                    />
                                    <span className="text-black">{statuses.find(s => s.id === lead.status)?.name || 'Status não encontrado'}</span>
                                    <ChevronDown className="w-3 h-3 text-gray-500" />
                                  </div>
                               </Button>
                             </DropdownMenuTrigger>
                             <DropdownMenuContent align="start" className="w-48">
                               {statuses.map((status) => {
                                 const isSelected = status.id === lead.status
                                 return (
                                   <DropdownMenuItem
                                     key={status.id}
                                     onClick={(e) => {
                                       e.stopPropagation()
                                       if (!isSelected) {
                                         handleStatusChange(lead.id, status.id)
                                       }
                                     }}
                                     className={cn(
                                       "flex items-center gap-2",
                                       isSelected && "bg-gray-100"
                                     )}
                                   >
                                     <div 
                                       className="w-3 h-3 rounded-full flex-shrink-0" 
                                       style={{ backgroundColor: status.color }}
                                     />
                                     <span className="text-sm">{status.name}</span>
                                   </DropdownMenuItem>
                                 )
                               })}
                             </DropdownMenuContent>
                           </DropdownMenu>
                         )}
                       </div>
                     </td>

                     {/* Ações */}
                     <td className="p-2 md:p-4 w-[12%]">
                       <div className="flex items-center gap-1 justify-end">
                         <button
                           onClick={(e) => {
                             e.stopPropagation();
                             // Lógica para comentários
                           }}
                           className="flex items-center gap-1 text-foreground hover:bg-gray-100 p-1 rounded"
                         >
                           <MessageCircle className="w-3 h-3" />
                           <span className="text-xs">{lead.comment_count || 0}</span>
                         </button>
                         <button
                           onClick={(e) => {
                             e.stopPropagation();
                             onEdit(lead);
                           }}
                           className="text-muted-foreground hover:text-primary hover:bg-gray-100 p-1 rounded"
                         >
                           <Edit className="w-4 h-4" />
                         </button>
                         <button
                           onClick={(e) => {
                             e.stopPropagation();
                             router.push(`/crm/${lead.id}`);
                           }}
                           className="text-muted-foreground hover:text-primary hover:bg-gray-100 p-1 rounded"
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
                             <Trash2 className="w-4 h-4" />
                           </button>
                         )}
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