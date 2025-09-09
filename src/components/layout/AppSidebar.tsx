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
  Building2
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
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import { useRoles } from "@/hooks/useRoles"

const navigationItems = [
  { title: "Dashboard", url: "/", icon: Home },
  { title: "Atas", url: "/atas", icon: ClipboardList },
  { title: "Tarefas", url: "/tarefas", icon: Ticket },
  { title: "CRM", url: "/crm", icon: Building2 },
  { title: "Relatórios", url: "/relatorios", icon: FileText },
]

const configItems = [
  { title: "Status", url: "/config/status", icon: BarChart3 },
  { title: "Status Tickets", url: "/config/ticket-status", icon: BarChart3 },
  { title: "Status CRM", url: "/config/crm-status", icon: BarChart3 },
  { title: "Usuários", url: "/config/usuarios", icon: Users },
  { title: "Condomínios", url: "/config/condominiums", icon: Building2 },
  { title: "Administradoras", url: "/config/administradoras", icon: Building2 },
  { title: "Tags", url: "/config/tags", icon: Tags },
]

export function AppSidebar() {
  const { state } = useSidebar()
  const collapsed = state === "collapsed"
  const navigate = useNavigate()
  const { user, userProfile, signOut } = useAuth()
  const { canAccessConfig } = useRoles()
  const [configExpanded, setConfigExpanded] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    navigate('/auth')
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

        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                     <NavLink 
                       to={item.url} 
                       end
                       className={({ isActive }) =>
                         `icon-text-align nav-item-hover p-2 rounded-md transition-colors ${
                           isActive 
                             ? "nav-item-active" 
                             : ""
                         }`
                       }
                     >
                       <item.icon className="w-4 h-4 shrink-0" />
                       {!collapsed && <span className="truncate">{item.title}</span>}
                     </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Configuration - Only for ADMIN */}
        {canAccessConfig() && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                   <SidebarMenuButton 
                     onClick={() => setConfigExpanded(!configExpanded)}
                     className="icon-text-align nav-item-hover p-2 rounded-md transition-colors"
                   >
                     <Settings className="w-4 h-4 shrink-0" />
                     {!collapsed && (
                       <>
                         <span className="truncate">Configurações</span>
                         {configExpanded ? (
                           <ChevronDown className="w-4 h-4 ml-auto shrink-0" />
                         ) : (
                           <ChevronRight className="w-4 h-4 ml-auto shrink-0" />
                         )}
                       </>
                     )}
                   </SidebarMenuButton>
                  {configExpanded && !collapsed && (
                    <SidebarMenuSub>
                      {configItems.map((item) => (
                        <SidebarMenuSubItem key={item.title}>
                          <SidebarMenuSubButton asChild>
                             <NavLink 
                               to={item.url}
                               className={({ isActive }) =>
                                 `icon-text-align nav-item-hover p-2 rounded-md transition-colors ${
                                   isActive 
                                     ? "nav-item-active" 
                                     : ""
                                 }`
                               }
                             >
                               <item.icon className="w-4 h-4 shrink-0" />
                               <span className="truncate">{item.title}</span>
                             </NavLink>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  )}
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