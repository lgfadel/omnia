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
  ChevronRight
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

const navigationItems = [
  { title: "Dashboard", url: "/", icon: Home },
  { title: "Atas", url: "/atas", icon: ClipboardList },
  { title: "Relatórios", url: "/relatorios", icon: FileText },
]

const configItems = [
  { title: "Status", url: "/config/status", icon: BarChart3 },
  { title: "Usuários", url: "/config/usuarios", icon: Users },
  { title: "Tags", url: "/config/tags", icon: Tags },
]

export function AppSidebar() {
  const { state } = useSidebar()
  const collapsed = state === "collapsed"
  const navigate = useNavigate()
  const { user, userProfile, signOut } = useAuth()
  const [configExpanded, setConfigExpanded] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    navigate('/auth')
  }

  return (
    <Sidebar
      className={collapsed ? "w-14" : "w-64"}
      collapsible="icon"
    >
      <SidebarContent>
        {/* Logo Area */}
        <div className="p-4 border-b border-sidebar-border">
          <div className="flex items-center justify-center">
            {!collapsed ? (
              <img 
              src="/lovable-uploads/6d3076bc-69b6-4b0c-bc8b-2589689cae6a.png" 
              alt="Omnia Logo" 
              className="h-12 w-auto"
            />
            ) : (
              <img 
            src="/lovable-uploads/6d3076bc-69b6-4b0c-bc8b-2589689cae6a.png" 
            alt="Omnia Logo" 
            className="h-8 w-8 object-contain"
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
                        isActive 
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" 
                          : "hover:bg-sidebar-accent/50"
                      }
                    >
                      <item.icon className="w-4 h-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Configuration */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  onClick={() => setConfigExpanded(!configExpanded)}
                  className="hover:bg-sidebar-accent/50"
                >
                  <Settings className="w-4 h-4" />
                  {!collapsed && (
                    <>
                      <span>Configurações</span>
                      {configExpanded ? (
                        <ChevronDown className="w-4 h-4 ml-auto" />
                      ) : (
                        <ChevronRight className="w-4 h-4 ml-auto" />
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
                              isActive 
                                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" 
                                : "hover:bg-sidebar-accent/50"
                            }
                          >
                            <item.icon className="w-4 h-4" />
                            <span>{item.title}</span>
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
      </SidebarContent>
      
      {/* User Section */}
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-2 p-2">
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
                  isActive 
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" 
                    : "hover:bg-sidebar-accent/50"
                }
              >
                <KeyRound className="w-4 h-4" />
                {!collapsed && <span>Alterar Senha</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Button
                variant="ghost"
                className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                onClick={handleSignOut}
              >
                <LogOut className="w-4 h-4" />
                {!collapsed && <span>Sair</span>}
              </Button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}