import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { EstablishmentHeader } from "./EstablishmentHeader";
import EstablishmentContacts from "./EstablishmentContacts";
import { EstablishmentTimeline } from "./EstablishmentTimeline";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, Target, TrendingUp } from "lucide-react";

interface Props {
  establishmentId: string | null;
  open: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

type QuickActionType = "phoning" | "mailing" | "visite" | "rdv";

export const EstablishmentSheet = ({
  establishmentId,
  open,
  onClose,
  onUpdate,
}: Props) => {
  const [model, setModel] = useState<any>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [actions, setActions] = useState<any[]>([]);
  const [params, setParams] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<"idle" | "saving">("idle");
  const [externalEditActionId, setExternalEditActionId] =
    useState<string | null>(null);

  const isCreateMode = !establishmentId || !model?.id;

  // ESC pour fermer
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  // Chargement global
  useEffect(() => {
    if (open) {
      if (establishmentId) {
        void fetchAll();
      } else {
        // Fiche vierge en mode création
        setModel({
          id: null,
          nom: "",
          statut: "prospect",
          groupe_id: null,
          activite_id: null,
          secteur_id: null,
          adresse: "",
          code_postal: "",
          ville: "",
          commentaire: "",
          concurrent_id: null,
          info_concurrent: "",
          coefficient_concurrent: "",
        });
        setContacts([]);
        setActions([]);
        setParams([]);
        setLoading(false);
      }
    } else {
      setModel(null);
      setContacts([]);
      setActions([]);
      setParams([]);
    }
  }, [open, establishmentId]);

  async function fetchAll() {
    if (!establishmentId) return;
    setLoading(true);

    const [{ data: est }, { data: c }, { data: a }] = await Promise.all([
      supabase
        .from("establishments")
        .select(
          `*, 
           groupe:groupe_id(valeur), 
           secteur:secteur_id(valeur), 
           activite:activite_id(valeur), 
           concurrent:concurrent_id(valeur)`
        )
        .eq("id", establishmentId)
        .single(),
      supabase
        .from("contacts")
        .select("*")
        .eq("etablissement_id", establishmentId)
        .order("created_at", { ascending: false }),
      supabase
        .from("actions")
        .select(`*, user:user_id(nom, prenom)`)
        .eq("etablissement_id", establishmentId)
        .order("date_action", { ascending: false }),
    ]);

    const { data: p } = await supabase
      .from("parametrages")
      .select("*")
      .order("valeur", { ascending: true });

    const { data: compHist } = await supabase
      .from("competitors_history")
      .select("coefficient, commentaire")
      .eq("etablissement_id", establishmentId)
      .order("date_info", { ascending: false })
      .limit(1);

    let enriched: any = est || null;
    if (enriched) {
      enriched.coefficient_concurrent =
        compHist && compHist.length > 0
          ? compHist[0].coefficient
          : null;
      if (!enriched.info_concurrent && compHist && compHist.length > 0) {
        enriched.info_concurrent = compHist[0].commentaire;
      }
    }

    setModel(enriched);
    setContacts(c || []);
    setActions(a || []);
    setParams(p || []);
    setLoading(false);
  }

  // Refresh uniquement contacts
  async function fetchContactsOnly() {
    if (!establishmentId) return;
    const { data: c } = await supabase
      .from("contacts")
      .select("*")
      .eq("etablissement_id", establishmentId)
      .order("created_at", { ascending: false });
    setContacts(c || []);
  }

  // Refresh uniquement actions
  async function fetchActionsOnly() {
    if (!establishmentId) return;
    const { data: a } = await supabase
      .from("actions")
      .select(`*, user:user_id(nom, prenom)`)
      .eq("etablissement_id", establishmentId)
      .order("date_action", { ascending: false });
    setActions(a || []);
  }

  // AUTOSAVE (debounced) – uniquement en mode édition (pas en création)
  const saveTimer = useRef<number | null>(null);
  const scheduleSave = useCallback(
    async (payload: any) => {
      if (!model || !model.id) return; // pas d'autosave en création
      if (saveTimer.current) clearTimeout(saveTimer.current);

      saveTimer.current = window.setTimeout(async () => {
        setSaving("saving");

        const full: any = { ...payload };

        // Gestion coefficient : on ne touche pas aux colonnes Supabase gérées par Lovable,
        // on enregistre dans competitors_history.
        let coefficientForHistory: number | null = null;
        const hasCoeff = Object.prototype.hasOwnProperty.call(
          full,
          "coefficient_concurrent"
        );
        const hasInfo = Object.prototype.hasOwnProperty.call(
          full,
          "info_concurrent"
        );

        if (hasCoeff) {
          const raw = full.coefficient_concurrent;
          if (raw === "" || raw == null) {
            coefficientForHistory = null;
          } else {
            const parsed = parseFloat(String(raw).replace(",", "."));
            coefficientForHistory = Number.isNaN(parsed)
              ? null
              : parsed;
          }
          // On ne l'envoie pas sur establishments (colonne probablement inexistante)
          delete full.coefficient_concurrent;
        }

        // Update "classique" sur establishments (sans coefficient)
        if (Object.keys(full).length > 0) {
          await supabase
            .from("establishments")
            .update(full)
            .eq("id", model.id);
        }

        // Historisation concurrent si coefficient ou info concurrent modifiés
        if (hasCoeff || hasInfo) {
          const today = new Date();
          const yyyy = today.getFullYear();
          const mm = String(today.getMonth() + 1).padStart(2, "0");
          const dd = String(today.getDate()).padStart(2, "0");
          const dateStr = `${yyyy}-${mm}-${dd}`;

          await supabase.from("competitors_history").insert({
            etablissement_id: model.id,
            concurrent_nom: model.concurrent?.valeur || "Non renseigné",
            coefficient: coefficientForHistory,
            taux_horaire: null,
            date_info: dateStr,
            commentaire:
              payload.info_concurrent ??
              model.info_concurrent ??
              null,
          } as any);
        }

        setSaving("idle");
        onUpdate();
      }, 600);
    },
    [model, onUpdate]
  );

  const onChange = (patch: any) => {
    setModel((prev: any) => (prev ? { ...prev, ...patch } : prev));
    // pas d'autosave en mode création
    if (!isCreateMode) {
      scheduleSave(patch);
    }
  };

  const groupes = useMemo(
    () => params.filter((p) => p.categorie === "groupe"),
    [params]
  );
  const secteurs = useMemo(
    () => params.filter((p) => p.categorie === "secteur"),
    [params]
  );
  const activites = useMemo(
    () => params.filter((p) => p.categorie === "activite"),
    [params]
  );
  const concurrents = useMemo(
    () => params.filter((p) => p.categorie === "concurrent"),
    [params]
  );

  // Quick actions -> création d'une action + ouverture directe en édition
  const handleQuickAction = async (type: QuickActionType) => {
    if (!establishmentId) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const dateStr = `${yyyy}-${mm}-${dd}`;

    const payload = {
      etablissement_id: establishmentId,
      type,
      date_action: dateStr,
      statut_action: "a_venir" as const,
      commentaire: null,
      user_id: user?.id ?? "",
    };

    const { data, error } = await supabase
      .from("actions")
      .insert(payload as any)
      .select("id");

    if (!error && data && data.length > 0) {
      const inserted = data[0];
      setExternalEditActionId(inserted.id);
      await fetchActionsOnly();
    } else {
      await fetchActionsOnly();
    }
  };

  // Sauvegarde en mode création
  const handleCreateSave = async () => {
    if (!model) return;
    if (!model.nom || model.nom.trim() === "") return;

    const payload: any = {
      nom: model.nom.trim(),
      statut: model.statut || "prospect",
      groupe_id: model.groupe_id || null,
      activite_id: model.activite_id || null,
      secteur_id: model.secteur_id || null,
      adresse: model.adresse || null,
      code_postal: model.code_postal || null,
      ville: model.ville || null,
      commentaire: model.commentaire || null,
      concurrent_id: model.concurrent_id || null,
      info_concurrent: model.info_concurrent || null,
    };

    const { data, error } = await supabase
      .from("establishments")
      .insert(payload)
      .select("id")
      .single();

    if (!error && data) {
      onUpdate();
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end pointer-events-none">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-full max-w-5xl bg-white shadow-xl h-full overflow-y-auto border-l border-slate-200 pointer-events-auto">
        <EstablishmentHeader
          establishment={model}
          loading={loading}
          saving={saving === "saving"}
          onEstablishmentChange={onChange}
          onSave={isCreateMode ? handleCreateSave : () => {}}
          onClose={onClose}
          onQuickAction={handleQuickAction}
        />

        <div className="p-6">
          {loading ? (
            <div className="space-y-4">
              <div className="h-4 bg-slate-200 rounded animate-pulse" />
              <div className="h-4 bg-slate-200 rounded animate-pulse w-3/4" />
            </div>
          ) : !model ? (
            <div className="text-center text-slate-500 py-8">
              Établissement non trouvé
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[520px,1fr] gap-6">
              {/* Colonne gauche (infos + contacts + concurrence) */}
              <div className="space-y-6">
                {/* Informations */}
                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                  <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2 text-[15px]">
                    <Building2 className="h-5 w-5 text-[#840404]" /> Informations
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="text-sm font-medium text-slate-700">
                        Statut
                      </label>
                      <Select
                        value={model.statut || "prospect"}
                        onValueChange={(v: any) => onChange({ statut: v })}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="prospect">Prospect</SelectItem>
                          <SelectItem value="client">Client</SelectItem>
                          <SelectItem value="ancien_client">
                            Ancien client
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2">
                      <label className="text-sm font-medium text-slate-700">
                        Nom
                      </label>
                      <Input
                        className="mt-1"
                        value={model.nom || ""}
                        onChange={(e) =>
                          onChange({ nom: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">
                        Groupe
                      </label>
                      <Select
                        value={model.groupe_id || "none"}
                        onValueChange={(v) =>
                          onChange({
                            groupe_id: v === "none" ? null : v,
                          })
                        }
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Sélectionner" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Aucun</SelectItem>
                          {groupes.map((g: any) => (
                            <SelectItem key={g.id} value={g.id}>
                              {g.valeur}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">
                        Activité
                      </label>
                      <Select
                        value={model.activite_id || "none"}
                        onValueChange={(v) =>
                          onChange({
                            activite_id: v === "none" ? null : v,
                          })
                        }
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Sélectionner" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Aucune</SelectItem>
                          {activites.map((a: any) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.valeur}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">
                        Secteur
                      </label>
                      <Select
                        value={model.secteur_id || "none"}
                        onValueChange={(v) =>
                          onChange({
                            secteur_id: v === "none" ? null : v,
                          })
                        }
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Sélectionner" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Aucun</SelectItem>
                          {secteurs.map((s: any) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.valeur}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2">
                      <label className="text-sm font-medium text-slate-700">
                        Adresse
                      </label>
                      <Input
                        className="mt-1"
                        value={model.adresse || ""}
                        onChange={(e) =>
                          onChange({ adresse: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">
                        Code postal
                      </label>
                      <Input
                        className="mt-1"
                        value={model.code_postal || ""}
                        onChange={(e) =>
                          onChange({ code_postal: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">
                        Ville
                      </label>
                      <Input
                        className="mt-1"
                        value={model.ville || ""}
                        onChange={(e) =>
                          onChange({ ville: e.target.value })
                        }
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-sm font-medium text-slate-700">
                        Commentaire
                      </label>
                      <Textarea
                        rows={3}
                        className="mt-1 resize-none"
                        value={model.commentaire || ""}
                        onChange={(e) =>
                          onChange({ commentaire: e.target.value })
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* Contacts */}
                <EstablishmentContacts
                  contacts={contacts}
                  establishmentId={establishmentId}
                  onContactsUpdate={fetchContactsOnly}
                />

                {/* Concurrence */}
                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                  <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2 text-[15px]">
                    <Target className="h-5 w-5 text-[#840404]" /> Concurrence
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="text-sm font-medium text-slate-700">
                        Concurrent
                      </label>
                      <Select
                        value={model.concurrent_id || "none"}
                        onValueChange={(v) =>
                          onChange({
                            concurrent_id: v === "none" ? null : v,
                          })
                        }
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Sélectionner" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Aucun</SelectItem>
                          {concurrents.map((c: any) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.valeur}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">
                        Coefficient
                      </label>
                      <div className="relative mt-1">
                        <TrendingUp className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          className="pl-10"
                          inputMode="decimal"
                          placeholder="0,0 – 10,0"
                          value={model.coefficient_concurrent ?? ""}
                          onChange={(e) =>
                            onChange({
                              coefficient_concurrent: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                    <div className="col-span-2">
                      <label className="text-sm font-medium text-slate-700">
                        Infos
                      </label>
                      <Textarea
                        rows={3}
                        className="mt-1 resize-none"
                        value={model.info_concurrent || ""}
                        onChange={(e) =>
                          onChange({
                            info_concurrent: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Colonne droite : timeline */}
              <div className="space-y-6">
                <EstablishmentTimeline
                  actions={actions}
                  loading={loading}
                  establishmentId={establishmentId || model.id || ""}
                  onChanged={fetchActionsOnly}
                  externalEditActionId={externalEditActionId}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
