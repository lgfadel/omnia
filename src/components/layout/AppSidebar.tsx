import React from "react"
import { 
  ClipboardList, 
  Settings, 
  Users, 
  FileText,
  Home,
  BarChart3,
  Tags,
  LogOut,
  KeyRound,
  ChevronDown,
  ChevronRight,
  Ticket,
  Building2,
  Menu
} from "lucide-react"
import { NavLink, useNavigate } from "react-router-dom"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import { useAuth } from '@/components/auth/AuthProvider'
import { Button } from "@/components/ui/button"
import { useState, useMemo } from "react"
import { useRoles } from "@/hooks/useRoles"
import { useAccessibleMenuTree } from "@/hooks/useMenuItems"
import { MenuItem } from "@/repositories/menuItemsRepo.supabase"

// Mapeamento de ícones para os itens de menu
const iconMap: Record<string, any> = {
  'home': Home,
  'dashboard': Home,
  'atas': ClipboardList,
  'tarefas': Ticket,
  'tickets': Ticket,
  'crm': Building2,
  'relatorios': FileText,
  'reports': FileText,
  'config': Settings,
  'configuracoes': Settings,
  'status': BarChart3,
  'usuarios': Users,
  'users': Users,
  'condominiums': Building2,
  'condominios': Building2,
  'administradoras': Building2,
  'tags': Tags,
  'settings': Settings,
  'menu': Menu,
  'default': Menu
}

// Função para obter ícone baseado no nome ou tipo do menu
function getMenuIcon(menuItem: MenuItem) {
  // Primeiro tenta pelo campo icon se existir
  if (menuItem.icon && iconMap[menuItem.icon.toLowerCase()]) {
    return iconMap[menuItem.icon.toLowerCase()]
  }
  
  // Depois tenta pelo nome do menu
  const nameKey = menuItem.name.toLowerCase().replace(/\s+/g, '')
  if (iconMap[nameKey]) {
    return iconMap[nameKey]
  }
  
  // Depois tenta pelo path
  const pathKey = menuItem.path.replace('/', '').toLowerCase()
  if (iconMap[pathKey]) {
    return iconMap[pathKey]
  }
  
  // Fallback para ícone padrão
  return iconMap.default
}

export function AppSidebar() {
  const { state } = useSidebar()
  const collapsed = state === "collapsed"
  const navigate = useNavigate()
  const { user, userProfile, signOut } = useAuth()
  const { canAccessConfig } = useRoles()
  const { menuTree, isLoading, error } = useAccessibleMenuTree()
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

  const handleSignOut = async () => {
    await signOut()
    navigate('/auth')
  }

  // Função para alternar expansão de um item
  const toggleExpanded = (itemId: string) => {
    const newExpanded = new Set(expandedItems)
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId)
    } else {
      newExpanded.add(itemId)
    }
    setExpandedItems(newExpanded)
  }

  // Separar itens principais dos de configuração
  const { mainMenuItems, configMenuItems } = useMemo(() => {
    const main: MenuItem[] = []
    const config: MenuItem[] = []
    
    menuTree.forEach(item => {
      if (item.path.startsWith('/config')) {
        config.push(item)
      } else {
        main.push(item)
      }
    })
    
    return { mainMenuItems: main, configMenuItems: config }
  }, [menuTree])

  // Renderizar item de menu recursivamente
  const renderMenuItem = (item: MenuItem & { children?: MenuItem[] }, level = 0) => {
    const Icon = getMenuIcon(item)
    const hasChildren = item.children && item.children.length > 0
    const isExpanded = expandedItems.has(item.id)
    
    return (
      <SidebarMenuItem key={item.id}>
        {hasChildren ? (
          <>
            <SidebarMenuButton 
              onClick={() => toggleExpanded(item.id)}
              className="icon-text-align nav-item-hover p-2 rounded-md transition-colors"
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && (
                <>
                  <span className="truncate">{item.name}</span>
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 ml-auto shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 ml-auto shrink-0" />
                  )}
                </>
              )}
            </SidebarMenuButton>
            {isExpanded && !collapsed && (
              <SidebarMenuSub>
                {item.children?.map((child) => (
                  <SidebarMenuSubItem key={child.id}>
                    <SidebarMenuSubButton asChild>
                      <NavLink 
                        to={child.path}
                        className={({ isActive }) =>
                          `icon-text-align nav-item-hover p-2 rounded-md transition-colors ${
                            isActive 
                              ? "nav-item-active" 
                              : ""
                          }`
                        }
                      >
                        {React.createElement(getMenuIcon(child), { className: "w-4 h-4 shrink-0" })}
                        <span className="truncate">{child.name}</span>
                      </NavLink>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                ))}
              </SidebarMenuSub>
            )}
          </>
        ) : (
          <SidebarMenuButton asChild>
            <NavLink 
              to={item.path} 
              end
              className={({ isActive }) =>
                `icon-text-align nav-item-hover p-2 rounded-md transition-colors ${
                  isActive 
                    ? "nav-item-active" 
                    : ""
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="truncate">{item.name}</span>}
            </NavLink>
          </SidebarMenuButton>
        )}
      </SidebarMenuItem>
    )
  }

  return (
    <Sidebar
      className={`sidebar-responsive ${collapsed ? "w-14 collapsed" : "w-64"} transition-all duration-200 ease-in-out`}
      collapsible="icon"
    >
      <SidebarContent>
        {/* Logo Area */}
        <div className="p-4">
          <div className="flex items-center justify-center h-12">
            {!collapsed ? (
              <img 
                src="/lovable-uploads/6d3076bc-69b6-4b0c-bc8b-2589689cae6a.png" 
                alt="Omnia Logo" 
                className="h-10 w-auto object-contain"
              />
            ) : (
              <img 
                src="/lovable-uploads/6d3076bc-69b6-4b0c-bc8b-2589689cae6a.png" 
                alt="Omnia Logo" 
                className="h-6 w-6 object-contain"
              />
            )}
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <SidebarGroup>
            <SidebarGroupLabel>Carregando...</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {[1, 2, 3].map((i) => (
                  <SidebarMenuItem key={i}>
                    <div className="flex items-center gap-2 p-2">
                      <div className="w-4 h-4 bg-gray-300 rounded animate-pulse" />
                      {!collapsed && <div className="h-4 bg-gray-300 rounded flex-1 animate-pulse" />}
                    </div>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Error State */}
        {error && (
          <SidebarGroup>
            <SidebarGroupLabel>Erro</SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="p-2 text-sm text-red-500">
                Erro ao carregar menu: {error}
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Main Navigation */}
        {!isLoading && !error && mainMenuItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Principal</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {mainMenuItems.map((item) => renderMenuItem(item))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Configuration Menu */}
        {!isLoading && !error && configMenuItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Configurações</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {configMenuItems.map((item) => renderMenuItem(item))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Fallback para usuários com acesso de configuração mas sem itens no banco */}
        {!isLoading && !error && configMenuItems.length === 0 && canAccessConfig() && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to="/config"
                      className={({ isActive }) =>
                        `icon-text-align nav-item-hover p-2 rounded-md transition-colors ${
                          isActive 
                            ? "nav-item-active" 
                            : ""
                        }`
                      }
                    >
                      <Settings className="w-4 h-4 shrink-0" />
                      {!collapsed && <span className="truncate">Configurações</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      
      {/* User Section */}
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
             <div className="flex items-center gap-3 p-3">
               {!collapsed && (
                 <div className="flex-1 min-w-0">
                   <p className="text-sm font-medium text-sidebar-foreground truncate">
                     {userProfile?.name || 'Usuário'}
                   </p>
                   <p className="text-xs text-sidebar-foreground/60 truncate">
                     {user?.email}
                   </p>
                 </div>
               )}
             </div>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
               <NavLink 
                 to="/change-password"
                 className={({ isActive }) =>
                   `icon-text-align nav-item-hover p-2 rounded-md transition-colors ${
                     isActive 
                       ? "nav-item-active" 
                       : ""
                   }`
                 }
               >
                 <KeyRound className="w-4 h-4 shrink-0" />
                 {!collapsed && <span className="truncate">Alterar Senha</span>}
               </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
               <Button
                 variant="ghost"
                 className="icon-text-align nav-item-hover w-full justify-start p-2 text-sidebar-foreground rounded-md transition-colors"
                 onClick={handleSignOut}
               >
                 <LogOut className="w-4 h-4 shrink-0" />
                 {!collapsed && <span className="truncate">Sair</span>}
               </Button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}