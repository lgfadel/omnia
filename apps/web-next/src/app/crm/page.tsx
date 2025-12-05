"use client";

import { useEffect, useState } from 'react'
import { Search, Plus, ChevronDown, User, Filter, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

import { Layout } from '@/components/layout/Layout'
import { BreadcrumbOmnia } from '@/components/ui/breadcrumb-omnia'
import { CrmLeadsTable } from '@/components/crm/CrmLeadsTable'
import { CrmLeadForm } from '@/components/crm/CrmLeadForm'

import { useCrmLeadsStore } from '@/store/crmLeads.store'
import { useCrmStatusStore } from '@/store/crmStatus.store'
import { CrmLead } from '@/repositories/crmLeadsRepo.supabase'
import { useAuth } from '@/components/auth/AuthProvider'
import { useRoles } from '@/hooks/useRoles'
import { useEscapeKeyForAlert } from '@/hooks/useEscapeKeyForAlert'
import { getUserInitials, generateUserColor } from '@/lib/userColors'

export default function Crm() {
  const { user, userProfile } = useAuth()
  const { canAccessConfig } = useRoles()
  const { 
    leads, 
    loading, 
    filters, 
    fetchLeads, 
    setFilters, 
    deleteLead 
  } = useCrmLeadsStore()
  
  const { 
    statuses, 
    loading: statusesLoading, 
    loadStatuses 
  } = useCrmStatusStore()

  const [searchTerm, setSearchTerm] = useState('')
  const [deleteLeadId, setDeleteLeadId] = useState<string | null>(null)
  const [showOnlyMyOpportunities, setShowOnlyMyOpportunities] = useState(false)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingLead, setEditingLead] = useState<CrmLead | null>(null)
  const [statusFilter, setStatusFilter] = useState<string[]>([])

  // Hook para fechar AlertDialog com ESC
  useEscapeKeyForAlert(() => setDeleteLeadId(null), !!deleteLeadId)

  useEffect(() => {
    if (user) {
      fetchLeads()
      loadStatuses()
    }
  }, [user, fetchLeads, loadStatuses])

  const handleSearch = (value: string) => {
    setSearchTerm(value)
    if (value.trim()) {
      setFilters({ search: value })
    } else {
      setFilters({ search: undefined })
    }
  }

  const handleStatusFilterChange = (statusId: string) => {
    const newStatusFilter = statusFilter.includes(statusId)
      ? statusFilter.filter(id => id !== statusId)
      : [...statusFilter, statusId]
    
    setStatusFilter(newStatusFilter)
    
    if (newStatusFilter.length === 0) {
      setFilters({ status: undefined })
    } else {
      setFilters({ status: newStatusFilter })
    }
  }

  const handleSelectAllStatus = () => {
    const allStatusIds = sortedStatuses.map(status => status.id)
    const isAllSelected = allStatusIds.every(id => statusFilter.includes(id))
    
    if (isAllSelected) {
      setStatusFilter([])
      setFilters({ status: undefined })
    } else {
      setStatusFilter(allStatusIds)
      setFilters({ status: allStatusIds })
    }
  }

  const handleMyOpportunitiesToggle = () => {
    const newShowOnlyMy = !showOnlyMyOpportunities
    setShowOnlyMyOpportunities(newShowOnlyMy)
    
    if (newShowOnlyMy && userProfile?.id) {
      setFilters({ assignedTo: userProfile.id })
    } else {
      setFilters({ assignedTo: undefined })
    }
  }

  const handleDelete = (id: string) => {
    setDeleteLeadId(id)
  }

  const handleDeleteConfirm = () => {
    if (deleteLeadId) {
      deleteLead(deleteLeadId)
      setDeleteLeadId(null)
    }
  }

  const handleFormSuccess = () => {
    setIsFormOpen(false)
    setEditingLead(null)
    fetchLeads()
  }

  const handleEdit = (lead: CrmLead) => {
    setEditingLead(lead)
    setIsFormOpen(true)
  }

  const getStatusName = (statusId: string) => {
    const status = statuses.find(s => s.id === statusId)
    return status?.name || 'Desconhecido'
  }

  const getStatusColor = (statusId: string) => {
    const status = statuses.find(s => s.id === statusId)
    return status?.color || '#6B7280'
  }

  const statusCounts = leads.reduce((acc, lead) => {
    const statusName = getStatusName(lead.status)
    acc[statusName] = (acc[statusName] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const sortedStatuses = [...statuses].sort((a, b) => a.order - b.order)

  return (
    <Layout>
      <div className="space-y-6">
        <BreadcrumbOmnia 
          items={[
            { label: "Dashboard", href: "/" },
            { label: "Oportunidades", isActive: true }
          ]} 
        />
        
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Pipeline</h1>
          </div>
          <Button 
            onClick={() => setIsFormOpen(true)}
            className="bg-primary hover:bg-primary/90 w-12 h-12 p-0 rounded-lg flex items-center justify-center"
          >
            <Plus className="w-5 h-5" />
          </Button>
        </div>
        
        {/* Métricas rápidas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 lg:gap-4">
          {sortedStatuses.map((status) => (
            <div key={status.id} className="bg-card rounded-lg p-3 lg:p-4 border min-w-0 flex flex-col items-center text-center">
              <div 
                className="text-xl lg:text-2xl font-bold mb-1" 
                style={{ color: status.color }}
              >
                {statusCounts[status.name] || 0}
              </div>
              <div className="text-xs lg:text-sm text-muted-foreground truncate w-full" title={status.name}>
                {status.name}
              </div>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Buscar por nome do condomínio..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-10 h-10 p-0 flex items-center justify-center">
                <Filter className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[200px]">
              <DropdownMenuCheckboxItem
                checked={sortedStatuses.length > 0 && sortedStatuses.every(status => statusFilter.includes(status.id))}
                onCheckedChange={handleSelectAllStatus}
                className="font-medium"
              >
                Selecionar todos
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              {sortedStatuses.map((status) => (
                <DropdownMenuCheckboxItem
                  key={status.id}
                  checked={statusFilter.includes(status.id)}
                  onCheckedChange={() => handleStatusFilterChange(status.id)}
                >
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: status.color }}
                    />
                    <span className="text-black">{status.name}</span>
                  </div>
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Botão Minhas Oportunidades */}
          {userProfile && (
            <Button
              variant="default"
              size="sm"
              onClick={handleMyOpportunitiesToggle}
              className={`rounded-full w-8 h-8 p-0 flex items-center justify-center text-xs font-medium self-center transition-all duration-200 ${
                showOnlyMyOpportunities 
                  ? 'shadow-lg ring-2 ring-offset-1' 
                  : 'shadow-sm hover:shadow-md'
              }`}
              style={{
                backgroundColor: showOnlyMyOpportunities 
                  ? (userProfile ? (userProfile.color || generateUserColor(userProfile.id, userProfile.name)) : '#FBBF24')
                  : '#F3F4F6',
                borderColor: showOnlyMyOpportunities 
                  ? (userProfile ? (userProfile.color || generateUserColor(userProfile.id, userProfile.name)) : '#FBBF24')
                  : '#D1D5DB',
                color: showOnlyMyOpportunities ? 'white' : '#6B7280',
                ...(showOnlyMyOpportunities && userProfile && {
                  '--tw-ring-color': (userProfile.color || generateUserColor(userProfile.id, userProfile.name)) + '50'
                })
              }}
            >
              {getUserInitials(userProfile.name || userProfile.email)}
            </Button>
          )}
        </div>

        {/* Lista de leads */}
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="text-muted-foreground">Carregando leads...</div>
          </div>
        ) : leads.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum lead encontrado</h3>
            <p className="text-muted-foreground mb-4">
              {filters.status || filters.search
                ? 'Nenhum lead corresponde aos filtros aplicados.'
                : 'Comece criando seu primeiro lead.'}
            </p>
            {!filters.status && !filters.search && (
              <Button onClick={() => setIsFormOpen(true)}>
                Criar primeiro lead
              </Button>
            )}
          </div>
        ) : (
          <CrmLeadsTable
            leads={leads}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        )}
      </div>

      {/* Dialog para criar/editar lead */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingLead ? 'Editar Lead' : 'Novo Lead'}
            </DialogTitle>
          </DialogHeader>
          <CrmLeadForm
            lead={editingLead || undefined}
            onSuccess={handleFormSuccess}
            onCancel={() => setIsFormOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* AlertDialog para confirmação de exclusão */}
      <AlertDialog open={!!deleteLeadId} onOpenChange={() => setDeleteLeadId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este lead? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteLeadId(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  )
}
