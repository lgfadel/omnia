import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
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
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/atas" element={<Atas />} />
            <Route path="/atas/new" element={<AtaNew />} />
            <Route path="/atas/:id" element={<AtaDetail />} />
            <Route path="/atas/:id/edit" element={<AtaEdit />} />
            <Route path="/config/status" element={<ConfigStatus />} />
            <Route path="/config/usuarios" element={<ConfigUsuarios />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  )
}

export default App
