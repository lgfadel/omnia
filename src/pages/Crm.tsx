import { useEffect, useState } from 'react'
import { Search, Plus, ChevronDown, User, Filter, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
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
import { getUserInitials } from '@/lib/userColors'

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
  
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingLead, setEditingLead] = useState<CrmLead | undefined>()
  const [searchTerm, setSearchTerm] = useState('')
  const [deleteLeadId, setDeleteLeadId] = useState<string | null>(null)
  const [showOnlyMyOpportunities, setShowOnlyMyOpportunities] = useState(false)

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

  const handleStatusFilter = (status: string) => {
    if (status === 'all') {
      setFilters({ status: undefined })
    } else {
      setFilters({ status: status as CrmLead['status'] })
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

  const handleFormSuccess = () => {
    setIsFormOpen(false)
    setEditingLead(undefined)
    fetchLeads()
  }

  const handleEdit = (lead: CrmLead) => {
    setEditingLead(lead)
    setIsFormOpen(true)
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

  // Função para obter o nome do status pelo ID
  const getStatusName = (statusId: string) => {
    const status = statuses.find(s => s.id === statusId)
    return status?.name || 'Desconhecido'
  }

  // Função para obter a cor do status pelo ID
  const getStatusColor = (statusId: string) => {
    const status = statuses.find(s => s.id === statusId)
    return status?.color || '#6B7280'
  }

  // Calcular contadores de status usando os dados dinâmicos
  const statusCounts = leads.reduce((acc, lead) => {
    const statusName = getStatusName(lead.status)
    acc[statusName] = (acc[statusName] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  // Ordenar status pela ordem configurada
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
          <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingLead(undefined)}>
                <Plus className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingLead ? 'Editar Lead' : 'Novo Lead'}
                </DialogTitle>
              </DialogHeader>
              <CrmLeadForm
                lead={editingLead}
                onSuccess={handleFormSuccess}
                onCancel={() => setIsFormOpen(false)}
              />
            </DialogContent>
          </Dialog>
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
        
        <Select onValueChange={handleStatusFilter} defaultValue="all">
          <SelectTrigger className="w-[200px]">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {sortedStatuses.map((status) => (
              <SelectItem key={status.id} value={status.id}>
                {status.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Botão Minhas Oportunidades */}
        {userProfile && (
          <Button
            variant="default"
            size="sm"
            onClick={handleMyOpportunitiesToggle}
            className={`rounded-full w-8 h-8 p-0 flex items-center justify-center text-xs font-medium self-center transition-all duration-200 ${
              showOnlyMyOpportunities 
                ? 'shadow-lg ring-2 ring-yellow-300 ring-offset-1' 
                : 'shadow-sm hover:shadow-md'
            }`}
            style={{
              backgroundColor: showOnlyMyOpportunities ? '#FBBF24' : '#F3F4F6',
              borderColor: showOnlyMyOpportunities ? '#FBBF24' : '#D1D5DB',
              color: showOnlyMyOpportunities ? 'white' : '#6B7280'
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
          <Button onClick={() => setIsFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Criar primeiro lead
          </Button>
        </div>
      ) : (
        <CrmLeadsTable
          leads={leads}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}
      </div>

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