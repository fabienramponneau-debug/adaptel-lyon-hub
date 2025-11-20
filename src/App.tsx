import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Etablissements from "./pages/Etablissements";
import Prospection from "./pages/Prospection";
import Reporting from "./pages/Reporting";
import Parametrage from "./pages/Parametrage";
import NotFound from "./pages/NotFound";
// Import du Provider qui manquait
import { UserViewProvider } from "./contexts/UserViewContext"; 

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        {/* CORRECTION: Le Provider doit envelopper les Routes */}
        <UserViewProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<Layout><Dashboard /></Layout>} />
            <Route path="/etablissements" element={<Layout><Etablissements /></Layout>} />
            <Route path="/prospection" element={<Layout><Prospection /></Layout>} />
            <Route path="/reporting" element={<Layout><Reporting /></Layout>} />
            <Route path="/parametrage" element={<Layout><Parametrage /></Layout>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </UserViewProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;