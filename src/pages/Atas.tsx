import { Layout } from "@/components/layout/Layout"
import { BreadcrumbOmnia } from "@/components/ui/breadcrumb-omnia"
import { TabelaOmnia } from "@/components/ui/tabela-omnia"
import { CardAtaKanban } from "@/components/ui/card-ata-kanban"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { LayoutGrid, List, Search, Plus, ChevronDown } from "lucide-react"
import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAtasStore } from "@/store/atas.store"
import { FIXTURE_USERS } from "@/data/fixtures"

const columns = [
  { key: "title", label: "Título", sortable: true, width: "40" },
  { key: "meetingDate", label: "Data Assembleia", sortable: true, width: "36" },
  { key: "secretary", label: "Secretário", width: "36" },
  { key: "status", label: "Status", width: "28" },
  { key: "ticket", label: "Ticket", width: "24" },
  { key: "commentCount", label: "Comentários", width: "16" }
]

const Atas = () => {
  const navigate = useNavigate()
  const { atas, statuses, loading, loadAtas, loadStatuses, deleteAta } = useAtasStore()
  
  const [viewMode, setViewMode] = useState<"table" | "kanban">("table")
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [sortField, setSortField] = useState<string>("")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")

  useEffect(() => {
    loadStatuses()
    loadAtas()
  }, [loadAtas, loadStatuses])

  useEffect(() => {
    loadAtas(search, statusFilter)
  }, [search, statusFilter, loadAtas])

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
  const tableData = atas.map(ata => {
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
    
    return {
      ...ata,
      secretary: ata.secretary?.name || "-",
      createdAt: new Date(ata.createdAt).toLocaleDateString('pt-BR'),
      meetingDate: ata.meetingDate ? new Date(ata.meetingDate).toLocaleDateString('pt-BR') : "-",
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
            <p className="text-muted-foreground">Gerencie e acompanhe todas as atas das assembleias</p>
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
          
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === "table" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("table")}
            >
              <List className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === "kanban" ? "default" : "outline"} 
              size="sm"
              onClick={() => setViewMode("kanban")}
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            Carregando atas...
          </div>
        ) : viewMode === "table" ? (
          <TabelaOmnia
            columns={columns}
            data={sortedData}
            onView={handleView}
            onDelete={handleDelete}
            sortField={sortField}
            sortDirection={sortDirection}
            onSort={handleSort}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {atas.map((ata) => {
              // Find the actual status from the loaded statuses
              const currentStatus = statuses.find(s => s.id === ata.statusId)
              
              // Map status name to badge variant (same logic as table)
              let mappedStatus: "nao-iniciado" | "em-andamento" | "concluido" = "nao-iniciado"
              
              if (currentStatus) {
                const statusName = currentStatus.name.toLowerCase()
                if (statusName.includes('andamento') || statusName.includes('progresso')) {
                  mappedStatus = "em-andamento"
                } else if (statusName.includes('concluído') || statusName.includes('finalizado')) {
                  mappedStatus = "concluido"
                } else {
                  mappedStatus = "nao-iniciado"
                }
              }
              
              return (
                <CardAtaKanban
                  key={ata.id}
                  data={{
                    id: ata.id,
                    titulo: ata.title,
                    descricao: ata.description || "",
                    dataAssembleia: ata.meetingDate || "",
                    totalParticipantes: 0, // Mock data doesn't have this
                    totalDocumentos: ata.attachments?.length || 0,
                    status: mappedStatus,
                    prioridade: "media" as const
                  }}
                  onView={handleView}
                  onDelete={handleDelete}
                />
              )
            })}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Atas;