// src/components/Layout.tsx - CORRIGÉ (Résout l'erreur TS2339 proprement)
import { useEffect, ReactNode } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Bell, ChevronDown, LogOut, Briefcase, Calendar, BarChart3, Sliders } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useUserView } from "@/contexts/UserViewContext"; // Import du contexte correct
import { NavLink } from "@/components/NavLink";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: ReactNode;
}

const navItems = [
    { label: "Dashboard", path: "/", icon: "📊" },
    { label: "Portefeuille", path: "/etablissements", icon: "🏢" },
    { label: "Prospection", path: "/prospection", icon: "🎯" },
    { label: "Reporting", path: "/reporting", icon: "📈" },
    { label: "Paramétrage", path: "/parametrage", icon: "⚙️" },
];

export const Layout = ({ children }: LayoutProps) => {
  const navigate = useNavigate();

  // TS2339 CORRIGÉ: profile est maintenant dans UserViewContextValue
  const { 
    currentUserId, 
    currentRole, 
    profile, // Profile est récupéré ici sans erreur
    loadingUserView,
    selectedUserId, 
    setSelectedUserId, 
    users 
  } = useUserView(); 

  // Redirection si non connecté (inchangé)
  useEffect(() => {
    if (!loadingUserView && !currentUserId) {
        navigate("/auth");
    }
  }, [loadingUserView, currentUserId, navigate]);

  // Calcul du nom affiché (utilise le profile exposé)
  const displayName = profile 
    ? `${profile.prenom ?? ""} ${profile.nom ?? ""}`.trim() || "Utilisateur"
    : "Utilisateur";

  if (loadingUserView) return null;

  if (!currentUserId) return null;

  const email = profile?.email || ""; 
  const initial =
    displayName && displayName.trim().length > 0
      ? displayName.trim().charAt(0).toUpperCase()
      : email && email.includes("@")
      ? email.split("@")[0].charAt(0).toUpperCase()
      : "U";

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };
  
  // Rendu du sélecteur Admin
  const renderAdminUserSelector = () => {
    if (currentRole !== "admin") return null;

    return (
        <div className="hidden lg:flex items-center gap-2 mr-4 border-r pr-4">
            <span className="text-xs font-medium text-slate-500">Vue :</span>
            <select
                className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm focus:border-[#840404]"
                value={selectedUserId || "tous"}
                onChange={(e) => setSelectedUserId(e.target.value)}
            >
                <option value="tous">Tous les commerciaux</option>
                {users
                    .filter(u => u.id !== 'tous')
                    .map((u) => (
                        <option key={u.id} value={u.id}>
                            {u.label}
                        </option>
                    ))}
            </select>
        </div>
    );
  };


  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-white to-slate-100/70">
      {/* Header moderne avec glass morphism */}
      <header className="sticky top-0 z-50 h-16 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 shadow-sm">
        <div className="w-full h-full px-6 lg:px-8 flex items-center justify-between">
          
          {/* Logo et nom App (Uniformisé) */}
          <Link to="/" className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#840404] to-[#a00606] shadow-lg flex items-center justify-center">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="font-bold text-lg bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                ADAPTEL CRM
              </span>
              <span className="text-xs text-slate-500 font-medium">
                {currentRole === "admin" ? "Administration" : "Commercial"}
              </span>
            </div>
          </Link>
          
          {/* Navigation Centrale (Desktop) */}
          <div className="flex-1 hidden lg:flex flex-col items-center justify-center max-w-2xl">
            <nav className="flex items-center gap-1 bg-slate-100/80 rounded-xl p-1 backdrop-blur-sm">
              {navItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === "/"}
                  className={cn(
                    "px-3 py-2 rounded-lg transition-all duration-200 flex items-center gap-2 text-sm font-medium",
                    "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                  )}
                  activeClassName="bg-white text-[#840404] shadow-sm font-semibold"
                >
                  <span className="text-base">{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>

          {/* Actions utilisateur */}
          <div className="flex items-center gap-3">
            
            {/* SÉLECTEUR ADMIN */}
            {renderAdminUserSelector()}

            {/* Notifications */}
            <button
              type="button"
              className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white/60 hover:bg-white shadow-sm transition-all duration-200 hover:shadow-md"
              onClick={() => navigate("/")}
            >
              <Bell className="h-4 w-4 text-slate-600" />
            </button>

            {/* Profil utilisateur avec dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-xl p-1.5 hover:bg-slate-100/80 transition-colors duration-200">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-[#840404] text-white text-sm">
                      {initial}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden sm:flex flex-col items-start leading-tight">
                    <span className="text-sm font-semibold text-slate-900">
                      {displayName || "Utilisateur"}
                    </span>
                    <span className="text-xs text-slate-500">{currentRole === 'admin' ? "Admin" : "Commercial"}</span>
                  </div>
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-56 rounded-xl shadow-lg border-slate-200"
              >
                <DropdownMenuItem 
                  className="flex items-center gap-2 cursor-pointer text-red-600 focus:text-red-600"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Déconnexion
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Contenu principal */}
      <main className="flex-1 w-full">
        {/* Correction UX: Ajout d'un padding horizontal cohérent */}
        <div className="w-full px-6 lg:px-8 py-6">{children}</div>
      </main>
    </div>
  );
};