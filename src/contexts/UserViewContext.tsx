// src/contexts/UserViewContext.tsx - CORRIGÉ
import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";

type RoleType = "admin" | "commercial";

interface UserOption {
  id: string;
  label: string;
}

// Nouvelle interface pour le profil (pour être utilisé dans Layout.tsx)
interface UserProfile {
    prenom: string | null;
    nom: string | null;
    email: string | null;
}

interface UserViewContextValue {
  currentUserId: string | null;
  currentRole: RoleType | null;
  // Ajout de la propriété profile pour corriger l'erreur TS2339 dans Layout.tsx
  profile: UserProfile | null; 
  selectedUserId: string | null;
  selectedUserLabel: string;
  users: UserOption[];
  loadingUserView: boolean;
  setSelectedUserId: (id: string | null) => void;
}

const UserViewContext = createContext<UserViewContextValue | undefined>(
  undefined
);

export const UserViewProvider = ({ children }: { children: ReactNode }) => {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<RoleType | null>(null);
  const [profileData, setProfileData] = useState<UserProfile | null>(null); // NOUVEL ÉTAT POUR LE PROFIL
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [loadingUserView, setLoadingUserView] = useState(true);

  useEffect(() => {
    const init = async () => {
      setLoadingUserView(true);

      // 1) User connecté
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        console.error("Erreur getUser (UserViewContext) :", error.message);
        setLoadingUserView(false);
        return;
      }

      const user = data.user;
      if (!user) {
        setLoadingUserView(false);
        return;
      }

      setCurrentUserId(user.id);

      // 2) Rôle et Profile du user
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, prenom, nom, actif")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        console.error(
          "Erreur chargement profil (UserViewContext) :",
          profileError.message
        );
        setLoadingUserView(false);
        return;
      }

      const role = (profile?.role as RoleType) || "commercial";
      setCurrentRole(role);
      
      // Stockage du profil pour être utilisé dans Layout.tsx
      setProfileData({
          prenom: profile?.prenom || null,
          nom: profile?.nom || null,
          email: user.email || null, // L'email vient de l'objet user
      });


      // 3) Liste des utilisateurs visibles
      if (role === "admin") {
        // Admin : voit tous les utilisateurs actifs
        const { data: allProfiles, error: allError } = await supabase
          .from("profiles")
          .select("id, prenom, nom, actif")
          .eq("actif", true)
          .order("prenom", { ascending: true });

        if (allError) {
          console.error(
            "Erreur chargement profils actifs (UserViewContext) :",
            allError.message
          );
          setLoadingUserView(false);
          return;
        }

        const opts: UserOption[] =
          allProfiles?.map((p: any) => ({
            id: p.id,
            label: `${p.prenom ?? ""} ${p.nom ?? ""}`.trim() || "Utilisateur",
          })) || [];

        setUsers(opts);

        // Par défaut : on se positionne sur le user courant si présent dans la liste
        const currentOption =
          opts.find((o) => o.id === user.id) || opts[0] || null;
        setSelectedUserId(currentOption ? currentOption.id : null);
      } else {
        // User classique : ne voit que lui-même
        const label = `${profile?.prenom ?? ""} ${profile?.nom ?? ""}`.trim();
        const opt: UserOption = {
          id: user.id,
          label: label || "Utilisateur",
        };
        setUsers([opt]);
        setSelectedUserId(user.id);
      }

      setLoadingUserView(false);
    };

    void init();
  }, []);

  const selectedUserLabel =
    users.find((u) => u.id === selectedUserId)?.label || "Utilisateur";

  const value: UserViewContextValue = {
    currentUserId,
    currentRole,
    profile: profileData, // EXPOSE LE PROFIL ICI (Correction TS2339)
    selectedUserId,
    selectedUserLabel,
    users,
    loadingUserView,
    setSelectedUserId,
  };

  return (
    <UserViewContext.Provider value={value}>
      {children}
    </UserViewContext.Provider>
  );
};

export const useUserView = (): UserViewContextValue => {
  const ctx = useContext(UserViewContext);
  if (!ctx) {
    throw new Error("useUserView doit être utilisé dans un UserViewProvider");
  }
  return ctx;
};