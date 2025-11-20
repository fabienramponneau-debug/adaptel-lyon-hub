import { ReactNode, useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import { Building2, Bell, ChevronDown, Settings } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  const location = useLocation();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState<string>("");

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, session) => {
      setSession(session);
      if (!session) {
        navigate("/auth");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) {
        navigate("/auth");
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Récupération du nom à afficher (metadata -> profiles -> fallback email)
  useEffect(() => {
    const computeDisplayName = async () => {
      if (!session) {
        setDisplayName("Utilisateur");
        return;
      }

      const meta = (session.user.user_metadata || {}) as any;
      const email = session.user.email || "";
      const fallbackFromEmail =
        email && email.includes("@")
          ? email.split("@")[0].replace(".", " ")
          : "Utilisateur";

      // 1) Si le metadata a déjà prenom/nom (cas Lovable initial)
      if (meta.prenom || meta.nom) {
        const fullName = `${meta.prenom ? meta.prenom : ""} ${
          meta.nom ? meta.nom : ""
        }`.trim();
        setDisplayName(fullName || fallbackFromEmail);
        return;
      }

      // 2) Sinon on va chercher dans public.profiles
      const { data, error } = await supabase
        .from("profiles")
        .select("prenom, nom")
        .eq("id", session.user.id)
        .maybeSingle();

      if (error) {
        console.error("Erreur chargement profil :", error.message);
        setDisplayName(fallbackFromEmail);
        return;
      }

      if (data && (data.prenom || data.nom)) {
        const fullName = `${data.prenom ?? ""} ${data.nom ?? ""}`.trim();
        setDisplayName(fullName || fallbackFromEmail);
      } else {
        setDisplayName(fallbackFromEmail);
      }
    };

    computeDisplayName();
  }, [session]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center space-y-4">
          <div className="relative">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-r from-[#840404] to-[#a00606] animate-pulse"></div>
            <div className="absolute inset-0 border-2 border-[#840404]/20 rounded-2xl animate-spin"></div>
          </div>
          <p className="text-slate-600 font-medium">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  const email = session.user.email || "";
  const initial =
    displayName && displayName.trim().length > 0
      ? displayName.trim().charAt(0).toUpperCase()
      : email && email.includes("@")
      ? email.split("@")[0].charAt(0).toUpperCase()
      : "U";

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-white to-slate-100/70">
      {/* Header moderne avec glass morphism */}
      <header className="sticky top-0 z-50 h-16 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 shadow-sm">
        <div className="w-full h-full px-6 lg:px-8 flex items-center justify-between">
          {/* Logo et nom */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#840404] to-[#a00606] shadow-lg flex items-center justify-center">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="font-bold text-lg bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                ADAPTEL Lyon
              </span>
              <span className="text-xs text-slate-500 font-medium">
                CRM Clients
              </span>
            </div>
          </div>

          {/* Navigation centrale */}
          <div className="flex-1 flex flex-col items-center justify-center max-w-2xl">
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
            {/* Notifications */}
            <button
              type="button"
              className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white/60 hover:bg-white shadow-sm transition-all duration-200 hover:shadow-md"
              onClick={() => navigate("/")}
            >
              <Bell className="h-4 w-4 text-slate-600" />
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 border-2 border-white"></span>
            </button>

            {/* Profil utilisateur avec dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-xl p-1.5 hover:bg-slate-100/80 transition-colors duration-200">
                  <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-[#840404] to-[#a00606] flex items-center justify-center text-xs font-semibold text-white shadow-sm">
                    {initial}
                  </div>
                  <div className="hidden sm:flex flex-col items-start leading-tight">
                    <span className="text-sm font-semibold text-slate-900">
                      {displayName || "Utilisateur"}
                    </span>
                    <span className="text-xs text-slate-500">En ligne</span>
                  </div>
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-56 rounded-xl shadow-lg border-slate-200"
              >
                <DropdownMenuItem className="flex items-center gap-2 cursor-pointer">
                  <Settings className="h-4 w-4" />
                  Paramètres du compte
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="flex items-center gap-2 cursor-pointer text-red-600 focus:text-red-600"
                  onClick={handleLogout}
                >
                  <span>🚪</span>
                  Déconnexion
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Contenu principal */}
      <main className="flex-1 w-full">
        <div className="w-full px-6 lg:px-8 py-6">{children}</div>
      </main>
    </div>
  );
};
