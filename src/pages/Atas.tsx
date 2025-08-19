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

const columns = [
  { key: "title", label: "Título", sortable: true, width: "48" },
  { key: "meetingDate", label: "Data Assembleia", sortable: true, width: "24" },
  { key: "secretary", label: "Secretário", width: "24" },
  { key: "responsible", label: "Responsável", width: "24" },
  { key: "status", label: "Status", width: "20" },
  { key: "ticket", label: "Ticket", width: "20" },
  { key: "commentCount", label: "Comentários", width: "16" }
]

const Atas = () => {
  const navigate = useNavigate()
  const { atas, statuses, loading, loadAtas, loadStatuses, deleteAta } = useAtasStore()
  const { secretarios, loadSecretarios } = useSecretariosStore()
  const { userProfile } = useAuth()
  
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [sortField, setSortField] = useState<string>("")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")
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

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const handleView = (id: string | number) => {
    navigate(`/atas/${id}`)
  }

  const handleDelete = async (id: string | number) => {
    if (confirm("Tem certeza que deseja excluir esta ata?")) {
      await deleteAta(String(id))
    }
  }

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

  // Sort data
  const sortedData = [...tableData].sort((a, b) => {
    if (!sortField) return 0
    
    const aValue = a[sortField as keyof typeof a]
    const bValue = b[sortField as keyof typeof b]
    
    if (aValue < bValue) return sortDirection === "asc" ? -1 : 1
    if (aValue > bValue) return sortDirection === "asc" ? 1 : -1
    return 0
  })

  return (
    <Layout>
      <div className="space-y-6">
        <BreadcrumbOmnia 
          items={[
            { label: "Atas", isActive: true }
          ]} 
        />
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Atas de Assembleias</h1>
          </div>
          
          <Button 
            onClick={() => navigate('/atas/new')}
            className="bg-primary hover:bg-primary/90"
          >
            <Plus className="w-4 h-4 mr-2" />
            Adicionar Ata
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Buscar por título, ID ou descrição..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground whitespace-nowrap">Filtrar por status:</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="min-w-[150px] justify-between">
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

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            Carregando atas...
          </div>
        ) : (
          <TabelaOmnia
            columns={columns}
            data={sortedData}
            onView={handleView}
            onDelete={handleDelete}
            sortField={sortField}
            sortDirection={sortDirection}
            onSort={handleSort}
          />
        )}
      </div>
    </Layout>
  );
};

export default Atas;