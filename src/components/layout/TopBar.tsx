import { Search, Plus, Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useNavigate, useLocation } from "react-router-dom"

export function TopBar() {
  const navigate = useNavigate()
  const location = useLocation()
  
  // Hide search, filter, and add button on ATA detail pages
  const isAtaDetailPage = location.pathname.match(/^\/atas\/[^/]+$/) && !location.pathname.includes('/edit') && !location.pathname.includes('/new')
  const shouldHideControls = isAtaDetailPage
  
  return (
    <header className="h-16 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-full items-center gap-4 px-6">
        <SidebarTrigger className="w-6 h-6" />
        
        <div className="flex items-center gap-4 flex-1">
          {!shouldHideControls && (
            <>
              {/* Search */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input 
                  placeholder="Buscar atas..." 
                  className="pl-10 bg-background"
                />
              </div>

              {/* Status Filter */}
              <Select>
                <SelectTrigger className="w-[180px]">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Filtrar Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="nao-iniciado">Não Iniciado</SelectItem>
                  <SelectItem value="em-andamento">Em Andamento</SelectItem>
                  <SelectItem value="concluido">Concluído</SelectItem>
                </SelectContent>
              </Select>

              {/* Add Button */}
              <Button 
                className="gap-2 bg-primary hover:bg-primary/90"
                onClick={() => navigate('/atas/new')}
              >
                <Plus className="w-4 h-4" />
                Adicionar Ata
              </Button>
            </>
          )}
          
          {/* Spacer when controls are hidden */}
          {shouldHideControls && <div className="flex-1" />}
        </div>
      </div>
    </header>
  )
}