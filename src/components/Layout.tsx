import { useEffect, ReactNode } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useUserView } from "@/contexts/UserViewContext";
import { NavLink } from "@/components/NavLink";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: ReactNode;
}

const navItems = [
  { label: "Dashboard", path: "/" },
  { label: "Portefeuille", path: "/etablissements" },
  { label: "Carte", path: "/map" },      
  { label: "Prospection", path: "/prospection" },
  { label: "Reporting", path: "/reporting" },
  { label: "Paramétrage", path: "/parametrage" },
];

export const Layout = ({ children }: LayoutProps) => {
  const navigate = useNavigate();
  const {
    currentUserId,
    currentRole,
    profile, // Utilisé pour afficher le nom/prénom
    loadingUserView,
    selectedUserId,
    setSelectedUserId,
    users,
  } = useUserView();

  useEffect(() => {
    if (!loadingUserView && !currentUserId) navigate("/auth");
  }, [loadingUserView, currentUserId, navigate]);

  if (loadingUserView || !currentUserId) return null;

  // Logique pour afficher le nom et l'initiale du profil
  const displayName =
    profile
      ? `${profile.prenom ?? ""} ${profile.nom ?? ""}`.trim() ||
        "Utilisateur"
      : "Utilisateur";

  const initial =
    displayName.charAt(0)?.toUpperCase() ??
    profile?.email?.charAt(0)?.toUpperCase() ??
    "U";

  // FIX Déconnexion : Redirection forcée vers /auth après la déconnexion
  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  };

  const renderAdminUserSelector = () => {
    if (currentRole !== "admin") return null;

    return (
      <div className="hidden lg:flex items-center gap-2 mr-4 border-r pr-4">
        <span className="text-xs font-medium text-slate-500">Vue :</span>
        <select
          className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm"
          value={selectedUserId || "tous"}
          onChange={(e) => setSelectedUserId(e.target.value)}
        >
          <option value="tous">Tous les commerciaux</option>
          {users
            .filter((u) => u.id !== "tous")
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
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Header FIXÉ : utilise 'fixed' et z-50 pour rester visible */}
      <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-white border-b border-slate-200 shadow-sm">
        <div className="w-full h-full px-6 lg:px-8 flex items-center justify-between">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#840404] flex items-center justify-center text-white font-bold">
              A
            </div>
            <span className="font-bold text-lg text-slate-900">
              ADAPTEL CRM
            </span>
          </Link>

          {/* Navigation centrale allégée */}
          <nav className="hidden lg:flex items-center gap-3">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/"}
                className={cn(
                  "px-3 py-2 rounded-md text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                )}
                activeClassName="bg-[#840404]/10 text-[#840404] font-semibold"
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Section droite */}
          <div className="flex items-center gap-3">
            {renderAdminUserSelector()}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-slate-100">
                  
                  {/* AFFICHAGE NOM/PRENOM DE L'UTILISATEUR CONNECTÉ */}
                  <span className="hidden sm:inline text-sm font-medium text-slate-800">
                    {displayName}
                  </span>

                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-[#840404] text-white">
                      {initial}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-56 rounded-xl shadow-lg"
              >
                <DropdownMenuItem
                  className="cursor-pointer text-red-600"
                  onClick={handleLogout}
                >
                  Déconnexion
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

        </div>
      </header>
      
      {/* COMPENSATION : Espace vide pour décaler le contenu de la hauteur du header fixe (h-16) */}
      <div className="h-16 w-full" />

      {/* Contenu */}
      <main className="flex-1 w-full px-6 lg:px-8 py-6">{children}</main>
    </div>
  );
};
