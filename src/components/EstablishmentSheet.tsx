// src/components/EstablishmentSheet.tsx
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";
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
import {
  Building2,
  Target,
  TrendingUp,
  Handshake,
  XCircle,
  ArrowDownRight,
  ArrowRight,
  CheckCircle,
} from "lucide-react";
import {
  searchCitySuggestions,
  CitySuggestion,
  geocodeAddress,
} from "@/utils/geoApi";

interface Props {
  establishmentId: string | null;
  open: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

type QuickActionType = "phoning" | "mailing" | "visite" | "rdv";

interface PotentialOption {
  value: string;
  label: string;
  icon: ReactNode;
  colorClass: string;
}

const POTENTIAL_OPTIONS: PotentialOption[] = [
  {
    value: "Aucun",
    label: "Aucun",
    icon: <XCircle className="h-4 w-4 text-slate-500" />,
    colorClass: "bg-slate-100 text-slate-700 border-slate-300",
  },
  {
    value: "Faible",
    label: "Faible",
    icon: <ArrowDownRight className="h-4 w-4 text-yellow-600" />,
    colorClass: "bg-yellow-100 text-yellow-800 border-yellow-300",
  },
  {
    value: "Moyen",
    label: "Moyen",
    icon: <ArrowRight className="h-4 w-4 text-sky-600" />,
    colorClass: "bg-sky-100 text-sky-800 border-sky-300",
  },
  {
    value: "Fort",
    label: "Fort",
    icon: <CheckCircle className="h-4 w-4 text-green-600" />,
    colorClass: "bg-green-100 text-green-800 border-green-300",
  },
];

// Normalisation pour comparer les noms / villes (doublons)
const normalizeText = (str: string | null | undefined) =>
  (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Format date/heure FR pour les infos "Créé / Modifié"
const formatDateTime = (value?: string | null) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;

  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

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

  // ⚠️ on reste sur cette logique : création = pas d'establishmentId
  const isCreateMode = !establishmentId || !model?.id;

  // Suggestions ville / CP
  const [citySuggestions, setCitySuggestions] = useState<CitySuggestion[]>([]);
  const [cityLoading, setCityLoading] = useState(false);
  const cityTimeoutRef = useRef<number | null>(null);

  // Données pour gestion des doublons
  const [allEstablishments, setAllEstablishments] = useState<
    { id: string; nom: string; ville: string | null }[]
  >([]);
  const [duplicateMatches, setDuplicateMatches] = useState<
    { id: string; nom: string; ville: string | null }[]
  >([]);

  // Chargement des parametrages seul (pour la création)
  async function fetchParamsOnly() {
    const { data: p } = await supabase
      .from("parametrages")
      .select("*")
      .order("valeur", { ascending: true });

    setParams(p || []);
    setLoading(false);
  }

  // Chargement de la liste complète (pour doublons) – all établissements
  async function fetchAllEstablishmentsForDuplicates(
    currentId?: string | null
  ) {
    const { data } = await supabase
      .from("establishments")
      .select("id, nom, ville");

    if (data) {
      const asAny = data as any[];
      const filtered = currentId
        ? asAny.filter((e) => e.id !== currentId)
        : asAny;
      setAllEstablishments(
        filtered.map((e) => ({
          id: e.id as string,
          nom: (e.nom as string) || "",
          ville: (e.ville as string | null) ?? null,
        }))
      );
    } else {
      setAllEstablishments([]);
    }
  }

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
           concurrent:concurrent_id(valeur),
           commercial:commercial_id(nom, prenom)`
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
        compHist && compHist.length > 0 ? compHist[0].coefficient : null;
      if (!enriched.info_concurrent && compHist && compHist.length > 0) {
        enriched.info_concurrent = compHist[0].commentaire;
      }
    }

    setModel(enriched);
    setContacts(c || []);
    setActions(a || []);
    setParams(p || []);
    setLoading(false);

    // Charge les autres établissements pour la détection de doublons
    await fetchAllEstablishmentsForDuplicates(establishmentId);
  }

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
        // Fiche vierge en mode création + chargement des parametrages
        setModel({
          id: null,
          nom: "",
          statut: "prospect",
          potential_rating: null,
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
          latitude: null,
          longitude: null,
        });
        setContacts([]);
        setActions([]);
        setLoading(true);
        void fetchParamsOnly();
        void fetchAllEstablishmentsForDuplicates(null);
      }
    } else {
      setModel(null);
      setContacts([]);
      setActions([]);
      setParams([]);
      setCitySuggestions([]);
      setAllEstablishments([]);
      setDuplicateMatches([]);
    }
  }, [open, establishmentId]);

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

  // AUTOSAVE (debounced) – uniquement en mode édition
  const saveTimer = useRef<number | null>(null);
  const scheduleSave = useCallback(
    async (payload: any) => {
      if (!model || !model.id) return; // pas d'autosave en création
      if (saveTimer.current) clearTimeout(saveTimer.current);

      saveTimer.current = window.setTimeout(async () => {
        setSaving("saving");

        const full: any = { ...payload };

        // --- GÉOCODAGE SI ADRESSE / CP / VILLE MODIFIÉS
        //     OU SI PAS ENCORE DE COORDONNÉES EN BASE ---
        const addressFields: (keyof typeof full)[] = [
          "adresse",
          "code_postal",
          "ville",
        ];

        const hasAddressPatch = addressFields.some((f) =>
          Object.prototype.hasOwnProperty.call(full, f)
        );

        const missingCoords =
          model.latitude == null || model.longitude == null;

        const shouldGeocode = hasAddressPatch || missingCoords;

        if (shouldGeocode) {
          const modelForGeocode: any = {
            ...model,
            ...full,
          };
          const coords = await geocodeAddress(
            modelForGeocode.adresse || null,
            modelForGeocode.code_postal || null,
            modelForGeocode.ville || null
          );

          if (coords) {
            full.latitude = coords.latitude;
            full.longitude = coords.longitude;
          } else {
            full.latitude = null;
            full.longitude = null;
          }
        }

        // Gestion coefficient : on n'écrit pas sur establishments mais sur competitors_history
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
            coefficientForHistory = Number.isNaN(parsed) ? null : parsed;
          }
          delete full.coefficient_concurrent;
        }

        if (Object.keys(full).length > 0) {
          await supabase
            .from("establishments")
            .update(full)
            .eq("id", model.id);
        }

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
              payload.info_concurrent ?? model.info_concurrent ?? null,
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
    if (!isCreateMode) {
      scheduleSave(patch);
    }
  };

  // Listes paramétrage (sans useMemo pour éviter TS2589)
  const groupes = params.filter((p) => p.categorie === "groupe");
  const secteurs = params.filter((p) => p.categorie === "secteur");
  const activites = params.filter((p) => p.categorie === "activite");
  const concurrents = params.filter((p) => p.categorie === "concurrent");

  // Quick actions -> création d'une action + ouverture directe en édition
  const handleQuickAction = async (type: QuickActionType) => {
    if (!establishmentId) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

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
      user_id: user.id,
      contact_vu: null,
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

  // Gestion ville / code postal : saisie dans un sens ou l'autre
  const handleCityFieldChange = async (
    field: "ville" | "code_postal",
    value: string
  ) => {
    if (field === "ville") {
      onChange({ ville: value });
    } else {
      onChange({ code_postal: value });
    }

    const trimmed = value.trim();
    if (cityTimeoutRef.current) {
      window.clearTimeout(cityTimeoutRef.current);
    }
    if (trimmed.length < 2) {
      setCitySuggestions([]);
      return;
    }

    cityTimeoutRef.current = window.setTimeout(async () => {
      setCityLoading(true);
      const res = await searchCitySuggestions(trimmed);
      setCitySuggestions(res);
      setCityLoading(false);
    }, 250);
  };

  const handleSelectCitySuggestion = (s: CitySuggestion) => {
    onChange({
      ville: s.nom,
      code_postal: s.code_postal,
    });
    setCitySuggestions([]);
  };

  // Gestion Nom établissement : mise à jour + détection doublons "live"
  const handleNameChange = (value: string) => {
    onChange({ nom: value });

    const trimmed = value.trim();
    if (trimmed.length < 3 || allEstablishments.length === 0) {
      setDuplicateMatches([]);
      return;
    }

    const normalizedInput = normalizeText(trimmed);

    const matches = allEstablishments
      .filter((e) => {
        const n = normalizeText(e.nom);
        if (!n) return false;
        return (
          n === normalizedInput ||
          n.includes(normalizedInput) ||
          normalizedInput.includes(n)
        );
      })
      .slice(0, 5);

    setDuplicateMatches(matches);
  };

  // Sauvegarde en mode création (avec contrôle doublons stricts nom+ville + géocodage) – VERSION FIABILISÉE
  const handleCreateSave = async () => {
    if (!model) return;

    if (!model.nom || model.nom.trim() === "") {
      alert("Le nom de l'établissement est obligatoire.");
      return;
    }

    // Vérifier session utilisateur
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      alert("Votre session a expiré. Veuillez vous reconnecter.");
      return;
    }

    const normalizedNom = normalizeText(model.nom);
    const normalizedVille = normalizeText(model.ville);

    // Doublon strict : même nom + même ville (uniquement si ville saisie)
    const strictDuplicate = allEstablishments.find((e) => {
      if (!normalizedNom || !normalizedVille) return false;
      const n = normalizeText(e.nom);
      const v = normalizeText(e.ville);
      return n === normalizedNom && v === normalizedVille;
    });

    if (strictDuplicate) {
      const confirmed = window.confirm(
        `Un établissement existe déjà avec ce nom et cette ville :\n\n` +
          `"${strictDuplicate.nom}" (${strictDuplicate.ville || "ville non renseignée"}).\n\n` +
          `Êtes-vous certain de vouloir créer un nouvel établissement ?`
      );
      if (!confirmed) {
        return;
      }
    }

    setSaving("saving");

    try {
      // GÉOCODAGE AVANT INSERT
      const coords = await geocodeAddress(
        model.adresse || null,
        model.code_postal || null,
        model.ville || null
      );

      const payload: any = {
        nom: model.nom.trim(),
        statut: model.statut || "prospect",
        potential_rating: model.potential_rating ?? null,
        groupe_id: model.groupe_id || null,
        activite_id: model.activite_id || null,
        secteur_id: model.secteur_id || null,
        adresse: model.adresse || null,
        code_postal: model.code_postal || null,
        ville: model.ville || null,
        commentaire: model.commentaire || null,
        concurrent_id: model.concurrent_id || null,
        info_concurrent: model.info_concurrent || null,
        commercial_id: user.id, // 🔐 toujours renseigné
        latitude: coords ? coords.latitude : null,
        longitude: coords ? coords.longitude : null,
      };

      const { data, error } = await supabase
        .from("establishments")
        .insert(payload)
        .select("id")
        .single();

      if (error) {
        console.error("Erreur création établissement", error);
        alert(
          "Impossible de créer l'établissement.\n\n" +
            (error.message || "Erreur inconnue.")
        );
        return;
      }

      if (!data) {
        alert(
          "Création terminée, mais aucune donnée retournée par le serveur."
        );
        return;
      }

      onUpdate();
      onClose();
    } catch (err: any) {
      console.error("Exception création établissement", err);
      alert(
        "Une erreur inattendue est survenue lors de la création de l'établissement."
      );
    } finally {
      setSaving("idle");
    }
  };

  // Option courante de potentiel (badge)
  const currentPotentialOption: PotentialOption | null = model?.potential_rating
    ? POTENTIAL_OPTIONS.find((opt) => opt.value === model.potential_rating) ||
      null
    : null;

  if (!open) return null;

  // Préparation des infos meta (créé / modifié)
  const createdAtLabel = formatDateTime(model?.created_at);
  const updatedAtLabel = formatDateTime(model?.updated_at);

  const creatorName =
    model?.commercial &&
    (model.commercial.prenom || model.commercial.nom)
      ? `${model.commercial.prenom ?? ""} ${
          model.commercial.nom ?? ""
        }`.trim()
      : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end pointer-events-none">
      {/* Overlay clicable derrière la fiche */}
      <div className="absolute inset-0" onClick={onClose} />
      {/* Fiche client à droite */}
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

        {/* Bandeau infos "Créé / Modifié" */}
        {model && (createdAtLabel || updatedAtLabel) && (
          <div className="px-6 pt-3 pb-2 border-b border-slate-100 text-xs text-slate-500 flex flex-wrap gap-x-6 gap-y-1">
            {createdAtLabel && (
              <div>
                <span className="font-medium">Créé le</span>{" "}
                {createdAtLabel}
                {creatorName && (
                  <>
                    {" "}
                    par{" "}
                    <span className="font-medium">{creatorName}</span>
                  </>
                )}
              </div>
            )}
            {updatedAtLabel && (
              <div>
                <span className="font-medium">Modifié le</span>{" "}
                {updatedAtLabel}
              </div>
            )}
          </div>
        )}

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
              {/* Colonne gauche */}
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

                    {/* Nom + alerte doublons */}
                    <div className="col-span-2">
                      <label className="text-sm font-medium text-slate-700">
                        Nom
                      </label>
                      <Input
                        className="mt-1"
                        value={model.nom || ""}
                        onChange={(e) => handleNameChange(e.target.value)}
                        placeholder="Nom de l'établissement"
                      />
                      {duplicateMatches.length > 0 && (
                        <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                          <p className="font-medium mb-1">
                            Attention : établissement similaire déjà présent
                            dans votre base.
                          </p>
                          <ul className="space-y-0.5">
                            {duplicateMatches.map((e) => (
                              <li
                                key={e.id}
                                className="flex items-center justify_between"
                              >
                                <span className="font-semibold">{e.nom}</span>
                                <span className="text-[11px] text-amber-800">
                                  {e.ville || "Ville non renseignée"}
                                </span>
                              </li>
                            ))}
                          </ul>
                          <p className="mt-1 text-[11px]">
                            Vous pouvez continuer la création si nécessaire.
                          </p>
                        </div>
                      )}
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
                      <label className="text_sm font-medium text-slate-700">
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
                          handleCityFieldChange("code_postal", e.target.value)
                        }
                        placeholder="Ex : 69003"
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
                          handleCityFieldChange("ville", e.target.value)
                        }
                        placeholder="Ex : Lyon"
                      />
                      {cityLoading && (
                        <p className="text-[11px] text-slate-400 mt-1">
                          Recherche des communes...
                        </p>
                      )}
                      {!cityLoading && citySuggestions.length > 0 && (
                        <div className="mt-1 max-h-40 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-sm text-xs">
                          {citySuggestions.map((s) => (
                            <button
                              key={`${s.nom}-${s.code_postal}`}
                              type="button"
                              onClick={() => handleSelectCitySuggestion(s)}
                              className="w-full px-2 py-1 text-left hover:bg-blue-50 flex justify-between"
                            >
                              <span>{s.nom}</span>
                              <span className="text-slate-500">
                                {s.code_postal}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                      {model.code_postal && (
                        <p className="text-[11px] text-slate-500 mt-1">
                          Code postal sélectionné :{" "}
                          <span className="font-semibold">
                            {model.code_postal}
                          </span>
                        </p>
                      )}
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

              {/* Colonne droite : potentiel + timeline */}
              <div className="space-y-6">
                {/* Section Notation du potentiel */}
                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                  <h3 className="font-semibold text-slate-900 mb-4 flex items-center justify-between text-[15px]">
                    <span className="flex items-center gap-2">
                      <Handshake className="h-5 w-5 text-[#840404]" />
                      Potentiel &amp; suivi
                    </span>
                    {currentPotentialOption && (
                      <div
                        className={`px-2 py-1 border text-xs rounded-md flex items-center gap-1 ${currentPotentialOption.colorClass}`}
                      >
                        {currentPotentialOption.icon}
                        <span className="font-medium">
                          {currentPotentialOption.value}
                        </span>
                      </div>
                    )}
                  </h3>

                  <label className="text-sm font-medium text-slate-700 mb-2 block">
                    Notation du potentiel client
                  </label>
                  <Select
                    value={model.potential_rating ?? "non_renseigne"}
                    onValueChange={(v: string) =>
                      onChange({
                        potential_rating:
                          v === "non_renseigne" ? null : v,
                      })
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Non renseigné" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="non_renseigne">
                        Non renseigné
                      </SelectItem>
                      {POTENTIAL_OPTIONS.map((option) => (
                        <SelectItem
                          key={option.value}
                          value={option.value}
                        >
                          <div className="flex items-center gap-2">
                            {option.icon}
                            <span>{option.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Timeline */}
                {establishmentId && (
                  <EstablishmentTimeline
                    actions={actions}
                    loading={loading}
                    establishmentId={establishmentId}
                    onChanged={fetchActionsOnly}
                    externalEditActionId={externalEditActionId}
                    onResetExternalEdit={() =>
                      setExternalEditActionId(null)
                    }
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Pour satisfaire à la fois les imports nommés et les imports par défaut
export default EstablishmentSheet;
