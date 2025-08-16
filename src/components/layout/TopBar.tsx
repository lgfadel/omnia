import { Search, Plus, Filter, LogOut, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useNavigate, useLocation } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"

export function TopBar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, userProfile, signOut } = useAuth()
  
  // Hide search, filter, and add button on ATA detail pages
  const isAtaDetailPage = location.pathname.match(/^\/atas\/[^/]+$/) && !location.pathname.includes('/edit') && !location.pathname.includes('/new')
  const shouldHideControls = isAtaDetailPage

  const handleSignOut = async () => {
    await signOut()
    navigate('/auth')
  }

  const getUserInitials = () => {
    if (userProfile?.name) {
      return userProfile.name
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    }
    if (user?.email) {
      return user.email[0].toUpperCase()
    }
    return 'U'
  }
  
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

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={userProfile?.avatarUrl} alt={userProfile?.name || ''} />
                  <AvatarFallback>{getUserInitials()}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {userProfile?.name || 'Usuário'}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user?.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sair</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}