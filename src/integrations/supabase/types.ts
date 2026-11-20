export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      actions: {
        Row: {
          commentaire: string | null
          created_at: string
          date_action: string
          etablissement_id: string
          id: string
          relance_date: string | null
          statut_action: Database["public"]["Enums"]["action_status"]
          type: Database["public"]["Enums"]["action_type"]
          user_id: string
        }
        Insert: {
          commentaire?: string | null
          created_at?: string
          date_action: string
          etablissement_id: string
          id?: string
          relance_date?: string | null
          statut_action?: Database["public"]["Enums"]["action_status"]
          type: Database["public"]["Enums"]["action_type"]
          user_id: string
        }
        Update: {
          commentaire?: string | null
          created_at?: string
          date_action?: string
          etablissement_id?: string
          id?: string
          relance_date?: string | null
          statut_action?: Database["public"]["Enums"]["action_status"]
          type?: Database["public"]["Enums"]["action_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "actions_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      competitors_history: {
        Row: {
          coefficient: number | null
          commentaire: string | null
          concurrent_nom: string
          created_at: string
          created_by: string | null
          date_info: string
          etablissement_id: string
          id: string
          taux_horaire: number | null
          updated_at: string
        }
        Insert: {
          coefficient?: number | null
          commentaire?: string | null
          concurrent_nom: string
          created_at?: string
          created_by?: string | null
          date_info?: string
          etablissement_id: string
          id?: string
          taux_horaire?: number | null
          updated_at?: string
        }
        Update: {
          coefficient?: number | null
          commentaire?: string | null
          concurrent_nom?: string
          created_at?: string
          created_by?: string | null
          date_info?: string
          etablissement_id?: string
          id?: string
          taux_horaire?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "competitors_history_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          actif: boolean
          created_at: string
          email: string | null
          etablissement_id: string
          fonction: string | null
          id: string
          nom: string
          prenom: string
          telephone: string | null
        }
        Insert: {
          actif?: boolean
          created_at?: string
          email?: string | null
          etablissement_id: string
          fonction?: string | null
          id?: string
          nom: string
          prenom: string
          telephone?: string | null
        }
        Update: {
          actif?: boolean
          created_at?: string
          email?: string | null
          etablissement_id?: string
          fonction?: string | null
          id?: string
          nom?: string
          prenom?: string
          telephone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      establishments: {
        Row: {
          agency_client_id: string | null
          activite_id: string | null
          adresse: string | null
          actif: boolean
          client_triggered_at: string | null
          client_triggered_by: string | null
          code_postal: string | null
          commentaire: string | null
          commercial_id: string | null
          erp_client_code: string | null
          concurrent_id: string | null
          converted_by: string | null
          created_at: string
          groupe_id: string | null
          id: string
          info_concurrent: string | null
          nom: string
          secteur_id: string | null
          statut: Database["public"]["Enums"]["establishment_status"]
          updated_at: string
          ville: string | null
          // NOUVEAU
          latitude: number | null
          longitude: number | null
          siret: string | null
        }
        Insert: {
          agency_client_id?: string | null
          activite_id?: string | null
          adresse?: string | null
          actif?: boolean
          client_triggered_at?: string | null
          client_triggered_by?: string | null
          code_postal?: string | null
          commentaire?: string | null
          commercial_id?: string | null
          erp_client_code?: string | null
          concurrent_id?: string | null
          converted_by?: string | null
          created_at?: string
          groupe_id?: string | null
          id?: string
          info_concurrent?: string | null
          nom: string
          secteur_id?: string | null
          statut?: Database["public"]["Enums"]["establishment_status"]
          updated_at?: string
          ville?: string | null
          // NOUVEAU
          latitude?: number | null
          longitude?: number | null
          siret?: string | null
        }
        Update: {
          agency_client_id?: string | null
          activite_id?: string | null
          adresse?: string | null
          actif?: boolean
          client_triggered_at?: string | null
          client_triggered_by?: string | null
          code_postal?: string | null
          commentaire?: string | null
          commercial_id?: string | null
          erp_client_code?: string | null
          concurrent_id?: string | null
          converted_by?: string | null
          created_at?: string
          groupe_id?: string | null
          id?: string
          info_concurrent?: string | null
          nom?: string
          secteur_id?: string | null
          statut?: Database["public"]["Enums"]["establishment_status"]
          updated_at?: string
          ville?: string | null
          // NOUVEAU
          latitude?: number | null
          longitude?: number | null
          siret?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "establishments_activite_id_fkey"
            columns: ["activite_id"]
            isOneToOne: false
            referencedRelation: "parametrages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "establishments_commercial_id_fkey"
            columns: ["commercial_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "establishments_concurrent_id_fkey"
            columns: ["concurrent_id"]
            isOneToOne: false
            referencedRelation: "parametrages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "establishments_groupe_id_fkey"
            columns: ["groupe_id"]
            isOneToOne: false
            referencedRelation: "parametrages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "establishments_secteur_id_fkey"
            columns: ["secteur_id"]
            isOneToOne: false
            referencedRelation: "parametrages"
            referencedColumns: ["id"]
          },
        ]
      }
      establishment_assignment_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          etablissement_id: string
          id: string
          new_commercial_id: string | null
          previous_commercial_id: string | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          etablissement_id: string
          id?: string
          new_commercial_id?: string | null
          previous_commercial_id?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          etablissement_id?: string
          id?: string
          new_commercial_id?: string | null
          previous_commercial_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "establishment_assignment_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "establishment_assignment_history_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "establishment_assignment_history_new_commercial_id_fkey"
            columns: ["new_commercial_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "establishment_assignment_history_previous_commercial_id_fkey"
            columns: ["previous_commercial_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_change_history: {
        Row: {
          after_data: Json | null
          before_data: Json | null
          change_source: string
          changed_at: string
          changed_by: string | null
          etablissement_id: string | null
          id: string
          operation: string
          period_code: string | null
          record_id: string
          record_type: string
          user_id: string | null
        }
        Insert: {
          after_data?: Json | null
          before_data?: Json | null
          change_source?: string
          changed_at?: string
          changed_by?: string | null
          etablissement_id?: string | null
          id?: string
          operation: string
          period_code?: string | null
          record_id: string
          record_type: string
          user_id?: string | null
        }
        Update: {
          after_data?: Json | null
          before_data?: Json | null
          change_source?: string
          changed_at?: string
          changed_by?: string | null
          etablissement_id?: string | null
          id?: string
          operation?: string
          period_code?: string | null
          record_id?: string
          record_type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_change_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_change_history_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_change_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      objectifs_financiers: {
        Row: {
          created_at: string
          id: string
          objectif_ca: number
          objectif_marge: number
          period_code: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          objectif_ca?: number
          objectif_marge?: number
          period_code: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          objectif_ca?: number
          objectif_marge?: number
          period_code?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "objectifs_financiers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      performances_clients: {
        Row: {
          agency_client_id: string | null
          chiffre_affaires: number
          cloture_at: string | null
          cloture_by: string | null
          commentaire: string | null
          created_at: string
          etablissement_id: string
          id: string
          marge: number
          period_code: string
          source: string
          statut_cloture: string
          updated_at: string
          user_id: string
        }
        Insert: {
          agency_client_id?: string | null
          chiffre_affaires?: number
          cloture_at?: string | null
          cloture_by?: string | null
          commentaire?: string | null
          created_at?: string
          etablissement_id: string
          id?: string
          marge?: number
          period_code: string
          source?: string
          statut_cloture?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          agency_client_id?: string | null
          chiffre_affaires?: number
          cloture_at?: string | null
          cloture_by?: string | null
          commentaire?: string | null
          created_at?: string
          etablissement_id?: string
          id?: string
          marge?: number
          period_code?: string
          source?: string
          statut_cloture?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "performances_clients_cloture_by_fkey"
            columns: ["cloture_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performances_clients_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performances_clients_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      parametrages: {
        Row: {
          categorie: Database["public"]["Enums"]["parametrage_category"]
          created_at: string
          id: string
          valeur: string
        }
        Insert: {
          categorie: Database["public"]["Enums"]["parametrage_category"]
          created_at?: string
          id?: string
          valeur: string
        }
        Update: {
          categorie?: Database["public"]["Enums"]["parametrage_category"]
          created_at?: string
          id?: string
          valeur?: string
        }
        Relationships: []
      }
      previsions_clients: {
        Row: {
          chiffre_affaires_estime_planning: number
          chiffre_affaires_previsionnel: number
          commentaire: string | null
          created_at: string
          etablissement_id: string
          id: string
          marge_estimee_planning: number | null
          marge_previsionnelle: number
          period_code: string
          planning_synced_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          chiffre_affaires_estime_planning?: number
          chiffre_affaires_previsionnel?: number
          commentaire?: string | null
          created_at?: string
          etablissement_id: string
          id?: string
          marge_estimee_planning?: number | null
          marge_previsionnelle?: number
          period_code: string
          planning_synced_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          chiffre_affaires_estime_planning?: number
          chiffre_affaires_previsionnel?: number
          commentaire?: string | null
          created_at?: string
          etablissement_id?: string
          id?: string
          marge_estimee_planning?: number | null
          marge_previsionnelle?: number
          period_code?: string
          planning_synced_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "previsions_clients_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "previsions_clients_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          actif: boolean
          created_at: string
          id: string
          nom: string
          prenom: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          actif?: boolean
          created_at?: string
          id: string
          nom: string
          prenom: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          actif?: boolean
          created_at?: string
          id?: string
          nom?: string
          prenom?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      suggestions: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          etablissement_id: string | null
          id: string
          priorite: string
          statut: string
          titre: string
          traite_at: string | null
          traite_by: string | null
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          etablissement_id?: string | null
          id?: string
          priorite?: string
          statut?: string
          titre: string
          traite_at?: string | null
          traite_by?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          etablissement_id?: string | null
          id?: string
          priorite?: string
          statut?: string
          titre?: string
          traite_at?: string | null
          traite_by?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suggestions_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      action_status: "effectue" | "a_venir" | "a_relancer"
      action_type: "phoning" | "mailing" | "visite" | "rdv"
      establishment_status: "prospect" | "client" | "ancien_client"
      parametrage_category: "groupe" | "secteur" | "activite" | "concurrent"
      user_role: "admin" | "commercial"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      action_status: ["effectue", "a_venir", "a_relancer"],
      action_type: ["phoning", "mailing", "visite", "rdv"],
      establishment_status: ["prospect", "client", "ancien_client"],
      parametrage_category: ["groupe", "secteur", "activite", "concurrent"],
      user_role: ["admin", "commercial"],
    },
  },
} as const
