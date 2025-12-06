import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { RoleProtectedRoute } from "@/components/auth/RoleProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
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
import ConfigCondominiums from "./pages/ConfigCondominiums";
import ConfigAdministradoras from "./pages/ConfigAdministradoras";
import ChangePassword from "./pages/ChangePassword";
import NotFound from "./pages/NotFound";
import Tickets from "./pages/Tickets";
import TicketNew from "./pages/TicketNew";
import TicketDetail from "./pages/TicketDetail";
import TicketEdit from "./pages/TicketEdit";
import ConfigTicketStatus from "./pages/ConfigTicketStatus";
import Crm from "./pages/Crm";
import { CrmLeadDetail } from "./pages/CrmLeadDetail";
import CrmLeadEdit from "./pages/CrmLeadEdit";
import ConfigCrmStatus from "./pages/config/ConfigCrmStatus";
import ConfigCrmOrigens from "./pages/config/ConfigCrmOrigens";

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
                  <ErrorBoundary>
                    <Index />
                  </ErrorBoundary>
                </ProtectedRoute>
              } />
              <Route path="/atas" element={
                <ProtectedRoute>
                  <ErrorBoundary>
                    <Atas />
                  </ErrorBoundary>
                </ProtectedRoute>
              } />
              <Route path="/atas/new" element={
                <ProtectedRoute>
                  <ErrorBoundary>
                    <AtaNew />
                  </ErrorBoundary>
                </ProtectedRoute>
              } />
              <Route path="/atas/:id" element={
                <ProtectedRoute>
                  <ErrorBoundary>
                    <AtaDetail />
                  </ErrorBoundary>
                </ProtectedRoute>
              } />
              <Route path="/atas/:id/edit" element={
                <ProtectedRoute>
                  <ErrorBoundary>
                    <AtaEdit />
                  </ErrorBoundary>
                </ProtectedRoute>
              } />
              <Route path="/config/status" element={
                <RoleProtectedRoute allowedRoles={['ADMIN']}>
                  <ErrorBoundary>
                    <ConfigStatus />
                  </ErrorBoundary>
                </RoleProtectedRoute>
              } />
              <Route path="/config/usuarios" element={
                <RoleProtectedRoute allowedRoles={['ADMIN']}>
                  <ErrorBoundary>
                    <ConfigUsuarios />
                  </ErrorBoundary>
                </RoleProtectedRoute>
              } />
              <Route path="/config/tags" element={
                <RoleProtectedRoute allowedRoles={['ADMIN']}>
                  <ErrorBoundary>
                    <ConfigTags />
                  </ErrorBoundary>
                </RoleProtectedRoute>
              } />
              <Route path="/config/condominiums" element={
                <RoleProtectedRoute allowedRoles={['ADMIN']}>
                  <ErrorBoundary>
                    <ConfigCondominiums />
                  </ErrorBoundary>
                </RoleProtectedRoute>
              } />
              <Route path="/config/administradoras" element={
                <RoleProtectedRoute allowedRoles={['ADMIN']}>
                  <ErrorBoundary>
                    <ConfigAdministradoras />
                  </ErrorBoundary>
                </RoleProtectedRoute>
              } />
              <Route path="/config/origens" element={
                <RoleProtectedRoute allowedRoles={['ADMIN']}>
                  <ErrorBoundary>
                    <ConfigCrmOrigens />
                  </ErrorBoundary>
                </RoleProtectedRoute>
              } />
              <Route path="/tarefas" element={
                <ProtectedRoute>
                  <ErrorBoundary>
                    <Tickets />
                  </ErrorBoundary>
                </ProtectedRoute>
              } />
              <Route path="/tarefas/new" element={
                <ProtectedRoute>
                  <ErrorBoundary>
                    <TicketNew />
                  </ErrorBoundary>
                </ProtectedRoute>
              } />
              <Route path="/tarefas/:id" element={
                <ProtectedRoute>
                  <ErrorBoundary>
                    <TicketDetail />
                  </ErrorBoundary>
                </ProtectedRoute>
              } />
              <Route path="/tarefas/:id/edit" element={
                <ProtectedRoute>
                  <ErrorBoundary>
                    <TicketEdit />
                  </ErrorBoundary>
                </ProtectedRoute>
              } />
              <Route path="/config/ticket-status" element={
                <RoleProtectedRoute allowedRoles={['ADMIN']}>
                  <ErrorBoundary>
                    <ConfigTicketStatus />
                  </ErrorBoundary>
                </RoleProtectedRoute>
              } />
              <Route path="/config/crm-status" element={
                <RoleProtectedRoute allowedRoles={['ADMIN']}>
                  <ErrorBoundary>
                    <ConfigCrmStatus />
                  </ErrorBoundary>
                </RoleProtectedRoute>
              } />
              <Route path="/crm" element={
                <ProtectedRoute>
                  <ErrorBoundary>
                    <Crm />
                  </ErrorBoundary>
                </ProtectedRoute>
              } />
              <Route path="/crm/:id" element={
                <ProtectedRoute>
                  <ErrorBoundary>
                    <CrmLeadDetail />
                  </ErrorBoundary>
                </ProtectedRoute>
              } />
              <Route path="/crm/edit/:id" element={
                <ProtectedRoute>
                  <ErrorBoundary>
                    <CrmLeadEdit />
                  </ErrorBoundary>
                </ProtectedRoute>
              } />
              <Route path="/change-password" element={
                <ProtectedRoute>
                  <ErrorBoundary>
                    <ChangePassword />
                  </ErrorBoundary>
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
