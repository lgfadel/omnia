import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Atas from "./pages/Atas";
import AtaNew from "./pages/AtaNew";
import AtaDetail from "./pages/AtaDetail";
import AtaEdit from "./pages/AtaEdit";
import ConfigStatus from "./pages/ConfigStatus";
import ConfigUsuarios from "./pages/ConfigUsuarios";
import NotFound from "./pages/NotFound";

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
                <ProtectedRoute>
                  <ConfigStatus />
                </ProtectedRoute>
              } />
              <Route path="/config/usuarios" element={
                <ProtectedRoute>
                  <ConfigUsuarios />
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
