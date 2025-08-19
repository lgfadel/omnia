import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { RoleProtectedRoute } from "@/components/auth/RoleProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import AccessDenied from "./pages/AccessDenied";
import Atas from "./pages/Atas";
import AtaNew from "./pages/AtaNew";
import AtaDetail from "./pages/AtaDetail";
import AtaEdit from "./pages/AtaEdit";
import ConfigStatus from "./pages/ConfigStatus";
import ConfigUsuarios from "./pages/ConfigUsuarios";
import { ConfigTags } from "./pages/ConfigTags";
import ChangePassword from "./pages/ChangePassword";
import NotFound from "./pages/NotFound";
import Tickets from "./pages/Tickets";
import TicketNew from "./pages/TicketNew";
import TicketDetail from "./pages/TicketDetail";
import TicketEdit from "./pages/TicketEdit";
import ConfigTicketStatus from "./pages/ConfigTicketStatus";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/access-denied" element={<AccessDenied />} />
              <Route path="/" element={
                <ProtectedRoute>
                  <Index />
                </ProtectedRoute>
              } />
              <Route path="/atas" element={
                <ProtectedRoute>
                  <Atas />
                </ProtectedRoute>
              } />
              <Route path="/atas/new" element={
                <ProtectedRoute>
                  <AtaNew />
                </ProtectedRoute>
              } />
              <Route path="/atas/:id" element={
                <ProtectedRoute>
                  <AtaDetail />
                </ProtectedRoute>
              } />
              <Route path="/atas/:id/edit" element={
                <ProtectedRoute>
                  <AtaEdit />
                </ProtectedRoute>
              } />
              <Route path="/config/status" element={
                <RoleProtectedRoute allowedRoles={['ADMIN']}>
                  <ConfigStatus />
                </RoleProtectedRoute>
              } />
              <Route path="/config/usuarios" element={
                <RoleProtectedRoute allowedRoles={['ADMIN']}>
                  <ConfigUsuarios />
                </RoleProtectedRoute>
              } />
              <Route path="/config/tags" element={
                <RoleProtectedRoute allowedRoles={['ADMIN']}>
                  <ConfigTags />
                </RoleProtectedRoute>
              } />
              <Route path="/tarefas" element={
                <ProtectedRoute>
                  <Tickets />
                </ProtectedRoute>
              } />
              <Route path="/tarefas/new" element={
                <ProtectedRoute>
                  <TicketNew />
                </ProtectedRoute>
              } />
              <Route path="/tarefas/:id" element={
                <ProtectedRoute>
                  <TicketDetail />
                </ProtectedRoute>
              } />
              <Route path="/tarefas/:id/edit" element={
                <ProtectedRoute>
                  <TicketEdit />
                </ProtectedRoute>
              } />
              <Route path="/config/ticket-status" element={
                <RoleProtectedRoute allowedRoles={['ADMIN']}>
                  <ConfigTicketStatus />
                </RoleProtectedRoute>
              } />
              <Route path="/change-password" element={
                <ProtectedRoute>
                  <ChangePassword />
                </ProtectedRoute>
              } />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  )
}

export default App
