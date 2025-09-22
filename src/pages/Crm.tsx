import { useEffect, useState } from 'react'
import { Plus, Search, Filter, Building2 } from 'lucide-react'
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
import { Badge } from '@/components/ui/badge'
import { Layout } from '@/components/layout/Layout'
import { BreadcrumbOmnia } from '@/components/ui/breadcrumb-omnia'
import { CrmLeadCard } from '@/components/crm/CrmLeadCard'
import { CrmLeadForm } from '@/components/crm/CrmLeadForm'

import { useCrmLeadsStore } from '@/store/crmLeads.store'
import { CrmLead } from '@/repositories/crmLeadsRepo.supabase'
import { useAuth } from '@/components/auth/AuthProvider'
import { useRoles } from '@/hooks/useRoles'
import { useEscapeKeyForAlert } from '@/hooks/useEscapeKeyForAlert'

export default function Crm() {
  const { user } = useAuth()
  const { canAccessConfig } = useRoles()
  const { 
    leads, 
    loading, 
    filters, 
    fetchLeads, 
    setFilters, 
    clearFilters,
    deleteLead 
  } = useCrmLeadsStore()
  
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingLead, setEditingLead] = useState<CrmLead | undefined>()
  const [searchTerm, setSearchTerm] = useState('')
  const [deleteLeadId, setDeleteLeadId] = useState<string | null>(null)

  // Hook para fechar AlertDialog com ESC
  useEscapeKeyForAlert(() => setDeleteLeadId(null), !!deleteLeadId)

  useEffect(() => {
    if (user) {
      fetchLeads()
    }
  }, [user, fetchLeads])

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

  const statusCounts = leads.reduce((acc, lead) => {
    acc[lead.status] = (acc[lead.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <Layout>
      <div className="space-y-6">
        <BreadcrumbOmnia 
          items={[
            { label: "CRM", isActive: true }
          ]} 
        />
        
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Pipeline</h1>
          </div>
          <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingLead(undefined)}>
                <Plus className="mr-2 h-4 w-4" />
                Novo Lead
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
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <div className="bg-card rounded-lg p-4 border">
          <div className="text-2xl font-bold">{leads.length}</div>
          <div className="text-sm text-muted-foreground">Total</div>
        </div>
        <div className="bg-card rounded-lg p-4 border">
          <div className="text-2xl font-bold text-blue-600">{statusCounts.novo || 0}</div>
          <div className="text-sm text-muted-foreground">Novos</div>
        </div>
        <div className="bg-card rounded-lg p-4 border">
          <div className="text-2xl font-bold text-green-600">{statusCounts.qualificado || 0}</div>
          <div className="text-sm text-muted-foreground">Qualificados</div>
        </div>
        <div className="bg-card rounded-lg p-4 border">
          <div className="text-2xl font-bold text-yellow-600">{statusCounts.proposta_enviada || 0}</div>
          <div className="text-sm text-muted-foreground">Propostas</div>
        </div>
        <div className="bg-card rounded-lg p-4 border">
          <div className="text-2xl font-bold text-orange-600">{statusCounts.em_negociacao || 0}</div>
          <div className="text-sm text-muted-foreground">Negociação</div>
        </div>
        <div className="bg-card rounded-lg p-4 border">
          <div className="text-2xl font-bold text-emerald-600">{statusCounts.ganho || 0}</div>
          <div className="text-sm text-muted-foreground">Ganhos</div>
        </div>
        <div className="bg-card rounded-lg p-4 border">
          <div className="text-2xl font-bold text-red-600">{statusCounts.perdido || 0}</div>
          <div className="text-sm text-muted-foreground">Perdidos</div>
        </div>
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
            <SelectItem value="novo">Novo</SelectItem>
            <SelectItem value="qualificado">Qualificado</SelectItem>
            <SelectItem value="proposta_enviada">Proposta Enviada</SelectItem>
            <SelectItem value="em_negociacao">Em Negociação</SelectItem>
            <SelectItem value="on_hold">Em Espera</SelectItem>
            <SelectItem value="ganho">Ganho</SelectItem>
            <SelectItem value="perdido">Perdido</SelectItem>
          </SelectContent>
        </Select>

        {(filters.status || filters.search) && (
          <Button variant="outline" onClick={clearFilters}>
            Limpar filtros
          </Button>
        )}
      </div>

      {/* Filtros ativos */}
      {(filters.status || filters.search) && (
        <div className="flex flex-wrap gap-2">
          {filters.status && (
            <Badge variant="secondary">
              Status: {filters.status}
            </Badge>
          )}
          {filters.search && (
            <Badge variant="secondary">
              Busca: {filters.search}
            </Badge>
          )}
        </div>
      )}

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {leads.map((lead) => (
            <CrmLeadCard
              key={lead.id}
              lead={lead}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
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