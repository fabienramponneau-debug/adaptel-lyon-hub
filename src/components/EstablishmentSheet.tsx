// components/EstablishmentSheet.tsx
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TrendingUp, Target, Building2 } from "lucide-react";

// Import des composants
import EstablishmentHeader from "./EstablishmentHeader";
import EstablishmentContacts from "./EstablishmentContacts";
import EstablishmentTimeline from "./EstablishmentTimeline";

interface EstablishmentSheetProps {
  establishmentId: string | null;
  open: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

const EstablishmentSheet = ({ establishmentId, open, onClose, onUpdate }: EstablishmentSheetProps) => {
  const [establishment, setEstablishment] = useState<any>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [actions, setActions] = useState<any[]>([]);
  const [parametrages, setParametrages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (establishmentId && open) {
      fetchEstablishmentData();
      fetchParametrages();
    }
  }, [establishmentId, open]);

  const fetchEstablishmentData = async () => {
    if (!establishmentId) return;
    
    setLoading(true);
    
    try {
      const { data: establishmentData, error } = await supabase
        .from("establishments")
        .select(`
          *,
          groupe:groupe_id(valeur),
          secteur:secteur_id(valeur),
          activite:activite_id(valeur),
          concurrent:concurrent_id(valeur)
        `)
        .eq("id", establishmentId)
        .single();

      if (error) throw error;

      const { data: contactsData, error: contactsError } = await supabase
        .from("contacts")
        .select("*")
        .eq("etablissement_id", establishmentId)
        .order("created_at", { ascending: false });

      const { data: actionsData, error: actionsError } = await supabase
        .from("actions")
        .select(`
          *,
          user:user_id(nom, prenom)
        `)
        .eq("etablissement_id", establishmentId)
        .order("date_action", { ascending: false });

      setEstablishment(establishmentData || null);
      setContacts(contactsData || []);
      setActions(actionsData || []);
    } catch (error) {
      console.error("Error fetching establishment data:", error);
      setEstablishment(null);
      setContacts([]);
      setActions([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchParametrages = async () => {
    try {
      const { data, error } = await supabase
        .from("parametrages")
        .select("*")
        .order("valeur", { ascending: true });
      
      if (error) throw error;
      setParametrages(data || []);
    } catch (error) {
      console.error("Error fetching parametrages:", error);
      setParametrages([]);
    }
  };

  const handleSave = async () => {
    if (!establishment) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from("establishments")
        .update({
          nom: establishment.nom,
          ville: establishment.ville,
          statut: establishment.statut,
          adresse: establishment.adresse,
          code_postal: establishment.code_postal,
          commentaire: establishment.commentaire,
          groupe_id: establishment.groupe_id,
          secteur_id: establishment.secteur_id,
          activite_id: establishment.activite_id,
          concurrent_id: establishment.concurrent_id,
          info_concurrent: establishment.info_concurrent,
          coefficient_concurrent: establishment.coefficient_concurrent,
        })
        .eq("id", establishment.id);

      if (error) throw error;
      onUpdate();
    } catch (error) {
      console.error("Error saving establishment:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleAddContact = async (newContact: any) => {
    if (!establishmentId) return;

    try {
      const { error } = await supabase
        .from("contacts")
        .insert([{
          etablissement_id: establishmentId,
          nom: newContact.nom,
          prenom: newContact.prenom,
          fonction: newContact.fonction || null,
          telephone: newContact.telephone || null,
          email: newContact.email || null,
        }]);

      if (error) throw error;

      const { data: contactsData, error: fetchError } = await supabase
        .from("contacts")
        .select("*")
        .eq("etablissement_id", establishmentId)
        .order("created_at", { ascending: false });
      
      if (!fetchError) {
        setContacts(contactsData || []);
      }
    } catch (error) {
      console.error("Error adding contact:", error);
    }
  };

  const handleEstablishmentChange = (updates: any) => {
    setEstablishment(prev => prev ? { ...prev, ...updates } : null);
  };

  if (!open) return null;

  const groupes = parametrages.filter(p => p.categorie === 'groupe');
  const secteurs = parametrages.filter(p => p.categorie === 'secteur');
  const activites = parametrages.filter(p => p.categorie === 'activite');
  const concurrents = parametrages.filter(p => p.categorie === 'concurrent');

  return (
    <div className="fixed inset-0 z-50 flex justify-end pointer-events-none">
      <div className="absolute inset-0" onClick={onClose} />
      
      <div className="relative w-full max-w-4xl bg-white shadow-xl h-full overflow-y-auto border-l border-slate-200 pointer-events-auto">
        <EstablishmentHeader
          establishment={establishment}
          loading={loading}
          saving={saving}
          onSave={handleSave}
          onClose={onClose}
          onEstablishmentChange={handleEstablishmentChange}
        />

        <div className="p-6">
          {loading ? (
            <div className="space-y-4">
              <div className="h-4 bg-slate-200 rounded animate-pulse"></div>
              <div className="h-4 bg-slate-200 rounded animate-pulse w-3/4"></div>
            </div>
          ) : establishment ? (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Colonne gauche - Informations et Contacts */}
              <div className="lg:col-span-2 space-y-6">
                {/* Informations générales */}
                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                  <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2 text-lg">
                    <Building2 className="h-5 w-5 text-[#840404]" />
                    Informations générales
                  </h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-slate-700">Adresse</label>
                      <Input
                        value={establishment.adresse || ""}
                        onChange={(e) => handleEstablishmentChange({ adresse: e.target.value })}
                        placeholder="Adresse"
                        className="mt-1"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-slate-700">Code postal</label>
                        <Input
                          value={establishment.code_postal || ""}
                          onChange={(e) => handleEstablishmentChange({ code_postal: e.target.value })}
                          placeholder="Code postal"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-slate-700">Groupe</label>
                        <Select
                          value={establishment.groupe_id || "none"}
                          onValueChange={(value) => handleEstablishmentChange({ groupe_id: value === "none" ? null : value })}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Sélectionner un groupe" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Aucun groupe</SelectItem>
                            {groupes.map((groupe) => (
                              <SelectItem key={groupe.id} value={groupe.id}>
                                {groupe.valeur}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-slate-700">Secteur</label>
                        <Select
                          value={establishment.secteur_id || "none"}
                          onValueChange={(value) => handleEstablishmentChange({ secteur_id: value === "none" ? null : value })}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Sélectionner un secteur" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Aucun secteur</SelectItem>
                            {secteurs.map((secteur) => (
                              <SelectItem key={secteur.id} value={secteur.id}>
                                {secteur.valeur}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-slate-700">Activité</label>
                        <Select
                          value={establishment.activite_id || "none"}
                          onValueChange={(value) => handleEstablishmentChange({ activite_id: value === "none" ? null : value })}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Sélectionner une activité" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Aucune activité</SelectItem>
                            {activites.map((activite) => (
                              <SelectItem key={activite.id} value={activite.id}>
                                {activite.valeur}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-slate-700">Commentaire</label>
                      <Textarea
                        value={establishment.commentaire || ""}
                        onChange={(e) => handleEstablishmentChange({ commentaire: e.target.value })}
                        placeholder="Commentaires..."
                        className="mt-1 resize-none"
                        rows={3}
                      />
                    </div>
                  </div>
                </div>

                {/* Contacts */}
                <EstablishmentContacts 
                  contacts={contacts}
                  onAddContact={handleAddContact}
                />

                {/* Concurrence */}
                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                  <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2 text-lg">
                    <Target className="h-5 w-5 text-[#840404]" />
                    Informations concurrence
                  </h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-slate-700">Concurrent actuel</label>
                      <Select
                        value={establishment.concurrent_id || "none"}
                        onValueChange={(value) => handleEstablishmentChange({ concurrent_id: value === "none" ? null : value })}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Sélectionner un concurrent" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Aucun concurrent</SelectItem>
                          {concurrents.map((concurrent) => (
                            <SelectItem key={concurrent.id} value={concurrent.id}>
                              {concurrent.valeur}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-slate-700">Coefficient</label>
                        <div className="relative mt-1">
                          <TrendingUp className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                          <Input
                            type="number"
                            step="0.1"
                            min="0"
                            max="10"
                            value={establishment.coefficient_concurrent || ""}
                            onChange={(e) => handleEstablishmentChange({ coefficient_concurrent: e.target.value })}
                            placeholder="0.0 - 10.0"
                            className="pl-10"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-slate-700">Informations complémentaires</label>
                      <Textarea
                        value={establishment.info_concurrent || ""}
                        onChange={(e) => handleEstablishmentChange({ info_concurrent: e.target.value })}
                        placeholder="Détails sur la situation concurrentielle..."
                        className="mt-1 resize-none"
                        rows={3}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Colonne droite - Timeline */}
              <div className="lg:col-span-2">
                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                  <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2 text-lg">
                    Historique des actions
                  </h3>
                  <EstablishmentTimeline actions={actions} />
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-slate-500 py-8">Établissement non trouvé</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EstablishmentSheet;