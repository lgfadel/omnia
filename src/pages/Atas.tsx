import { Layout } from "@/components/layout/Layout"
import { BreadcrumbOmnia } from "@/components/ui/breadcrumb-omnia"
import { TabelaOmnia } from "@/components/ui/tabela-omnia"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Search, Plus, ChevronDown, User } from "lucide-react"
import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAtasStore } from "@/store/atas.store"
import { FIXTURE_USERS } from "@/data/fixtures"
import { useSecretariosStore } from "@/store/secretarios.store"
import { useAuth } from "@/contexts/AuthContext"
import { generateUserColor, getUserInitials } from "@/lib/userColors"
import { supabase } from "@/integrations/supabase/client"

const columns = [
  { key: "title", label: "Título", width: "48" },
  { key: "meetingDate", label: "Data Assembleia", width: "24" },
  { key: "responsible", label: "Responsável", width: "24" },
  { key: "secretary", label: "Secretário", width: "24" },
  { key: "status", label: "Status", width: "20" },
  { key: "ticket", label: "Ticket", width: "20" },
  { key: "commentCount", label: "Comentários", width: "16" }
]

const Atas = () => {
  const navigate = useNavigate()
  const { atas, statuses, loading, loadAtas, loadStatuses, deleteAta, updateAta } = useAtasStore()
  const { secretarios, loadSecretarios } = useSecretariosStore()
  const { userProfile } = useAuth()
  
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [showOnlyMyAtas, setShowOnlyMyAtas] = useState(false)

  useEffect(() => {
    loadStatuses()
    loadAtas()
  }, [loadAtas, loadStatuses])

  useEffect(() => {
    loadAtas(search, statusFilter)
  }, [search, statusFilter, loadAtas])

  useEffect(() => {
    if (secretarios.length === 0) {
      loadSecretarios()
    }
  }, [secretarios.length, loadSecretarios])

  // Realtime listener para atualizações de atas
  useEffect(() => {
    const channel = supabase
      .channel('atas-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'omnia_atas'
        },
        (payload) => {
          console.log('Nova ata criada:', payload)
          // Recarregar a lista de atas quando uma nova for criada
          loadAtas(search, statusFilter)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'omnia_atas'
        },
        (payload) => {
          console.log('Ata atualizada:', payload)
          // Recarregar a lista quando uma ata for atualizada
          loadAtas(search, statusFilter)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'omnia_atas'
        },
        (payload) => {
          console.log('Ata excluída:', payload)
          // Recarregar a lista quando uma ata for excluída
          loadAtas(search, statusFilter)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [search, statusFilter, loadAtas])

  // Sorting is now fixed and cannot be modified by user

  const handleView = (id: string | number) => {
    navigate(`/atas/${id}`)
  }

  const handleDelete = async (id: string | number) => {
    if (confirm("Tem certeza que deseja excluir esta ata?")) {
      await deleteAta(String(id))
    }
  }

  const handleStatusChange = async (id: string | number, statusId: string) => {
    try {
      await updateAta(id.toString(), { statusId })
      // Reload atas to reflect the change
      loadAtas(search, statusFilter)
    } catch (error) {
      console.error('Erro ao atualizar status:', error)
    }
  }

  const handleResponsibleChange = async (id: string | number, userId: string) => {
    try {
      const selectedUser = secretarios.find(user => user.id === userId);
      if (selectedUser) {
        await updateAta(id.toString(), { responsible: selectedUser });
        loadAtas();
      }
    } catch (error) {
      console.error('Erro ao atualizar responsável:', error);
    }
  };

  const handleStatusFilterChange = (statusId: string) => {
    setStatusFilter(prev => 
      prev.includes(statusId) 
        ? prev.filter(id => id !== statusId)
        : [...prev, statusId]
    )
  }

  // Transform data for table display
  const filteredAtas = showOnlyMyAtas && userProfile 
    ? atas.filter(ata => ata.responsible?.id === userProfile.id)
    : atas
    
  const tableData = filteredAtas.map(ata => {
    // Find the actual status from the loaded statuses
    const currentStatus = statuses.find(s => s.id === ata.statusId)
    
    // Map status name to badge variant (simplified mapping for now)
    let mappedStatus: "nao-iniciado" | "em-andamento" | "concluido" = "nao-iniciado"
    
    if (currentStatus) {
      // Map based on status name to badge variant
      const statusName = currentStatus.name.toLowerCase()
      if (statusName.includes('andamento') || statusName.includes('progresso')) {
        mappedStatus = "em-andamento"
      } else if (statusName.includes('concluído') || statusName.includes('finalizado')) {
        mappedStatus = "concluido"
      } else {
        mappedStatus = "nao-iniciado"
      }
    }
    
    const secOverride = ata.secretary ? secretarios.find(s => s.id === ata.secretary?.id) : undefined
    const resOverride = ata.responsible ? secretarios.find(s => s.id === ata.responsible?.id) : undefined
    
    return {
      ...ata,
      secretary: ata.secretary ? { ...ata.secretary, color: secOverride?.color ?? ata.secretary.color } : null,
      responsible: ata.responsible ? { ...ata.responsible, color: resOverride?.color ?? ata.responsible.color } : null,
      secretaryName: ata.secretary?.name || "-",
      responsibleName: ata.responsible?.name || "-",
      createdAt: new Date(ata.createdAt).toLocaleDateString('pt-BR'),
      meetingDate: ata.meetingDate ? new Date(ata.meetingDate + 'T00:00:00').toLocaleDateString('pt-BR') : "-",
      commentCount: ata.commentCount || 0,
      status: mappedStatus,
      statusName: currentStatus?.name || "Status não encontrado",
      statusColor: currentStatus?.color || "#6B7280"
    }
  })

  // Sort data by status order_position (ascending), then by meeting date (descending)
  const sortedData = [...tableData].sort((a, b) => {
    // Primary sort: by status order_position (ascending)
    const aStatus = statuses.find(s => s.id === atas.find(ata => ata.id === a.id)?.statusId)
    const bStatus = statuses.find(s => s.id === atas.find(ata => ata.id === b.id)?.statusId)
    
    const aOrder = aStatus?.order || 999
    const bOrder = bStatus?.order || 999
    
    if (aOrder !== bOrder) {
      return aOrder - bOrder
    }
    
    // Secondary sort: by meeting date (descending)
    const aDate = a.meetingDate === '-' ? new Date(0) : new Date(atas.find(ata => ata.id === a.id)?.meetingDate + 'T00:00:00' || 0)
    const bDate = b.meetingDate === '-' ? new Date(0) : new Date(atas.find(ata => ata.id === b.id)?.meetingDate + 'T00:00:00' || 0)
    
    // Descending order for dates (newer dates first)
    return bDate.getTime() - aDate.getTime()
  })

  // Group data by status for separators
  const groupedData: Array<{ type: 'separator' | 'data', statusName: string, statusColor?: string, data?: any, count?: number }> = []
  let currentStatus = ''
  let currentStatusCount = 0
  
  sortedData.forEach((row, index) => {
    if (row.statusName !== currentStatus) {
      currentStatus = row.statusName
      currentStatusCount = sortedData.filter(r => r.statusName === currentStatus).length
      groupedData.push({
        type: 'separator',
        statusName: row.statusName,
        statusColor: row.statusColor,
        count: currentStatusCount
      })
    }
    groupedData.push({
      type: 'data',
      statusName: row.statusName,
      data: row
    })
  })

  return (
    <Layout>
      <div className="space-y-6">
        <BreadcrumbOmnia 
          items={[
            { label: "Atas", isActive: true }
          ]} 
        />
        
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Atas de Assembleias</h1>
          </div>
          
          <Button 
            onClick={() => navigate('/atas/new')}
            className="bg-primary hover:bg-primary/90 px-6 py-3 text-base font-medium"
          >
            <Plus className="w-5 h-5 mr-2" />
            Adicionar Ata
          </Button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg border p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Buscar por título, ID ou descrição..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 h-10"
              />
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground whitespace-nowrap">Status:</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="min-w-[150px] justify-between h-10">
                      {statusFilter.length === 0 
                        ? "Todos os status" 
                        : statusFilter.length === 1 
                        ? statuses.find(s => s.id === statusFilter[0])?.name
                        : `${statusFilter.length} selecionados`
                      }
                      <ChevronDown className="ml-2 h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56">
                    {statuses.map((status) => (
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
                          {status.name}
                        </div>
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              
              <Button
                variant="default"
                size="sm"
                onClick={() => setShowOnlyMyAtas(!showOnlyMyAtas)}
                className={`rounded-full w-8 h-8 p-0 flex items-center justify-center text-xs font-medium self-center transition-all duration-200 ${
                  showOnlyMyAtas 
                    ? 'shadow-lg ring-2 ring-yellow-300 ring-offset-1' 
                    : 'shadow-sm hover:shadow-md'
                }`}
                style={{
                  backgroundColor: showOnlyMyAtas ? '#FBBF24' : '#F3F4F6',
                  borderColor: showOnlyMyAtas ? '#FBBF24' : '#D1D5DB',
                  color: showOnlyMyAtas ? 'white' : '#6B7280'
                }}
              >
                {userProfile ? getUserInitials(userProfile.name) : <User className="w-3 h-3" />}
              </Button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border overflow-hidden">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              Carregando atas...
            </div>
          ) : (
            <TabelaOmnia
              columns={columns}
              data={groupedData}
              onView={handleView}
              onDelete={handleDelete}
              onStatusChange={handleStatusChange}
              onResponsibleChange={handleResponsibleChange}
              availableStatuses={statuses}
              availableUsers={secretarios}
              grouped={true}
            />
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Atas;