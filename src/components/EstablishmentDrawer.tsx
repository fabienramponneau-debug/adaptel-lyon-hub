import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Building2, Users, ClipboardList, Plus, Pencil, Trash2, Phone, Mail, Calendar, MapPin } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { Badge } from "@/components/ui/badge";

interface EstablishmentDrawerProps {
  establishmentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

interface Contact {
  id: string;
  nom: string;
  prenom: string;
  fonction: string | null;
  telephone: string | null;
  email: string | null;
  actif: boolean;
}

interface Action {
  id: string;
  type: "phoning" | "mailing" | "visite" | "rdv";
  date_action: string;
  statut_action: "effectue" | "a_venir" | "a_relancer";
  commentaire: string | null;
  relance_date: string | null;
  user_id: string;
  profiles: { nom: string; prenom: string } | null;
}

interface Establishment {
  id: string;
  nom: string;
  statut: "prospect" | "client" | "ancien_client";
  adresse: string | null;
  code_postal: string | null;
  ville: string | null;
  commentaire: string | null;
  info_concurrent: string | null;
  groupe_id: string | null;
  secteur_id: string | null;
  activite_id: string | null;
  concurrent_id: string | null;
  commercial_id: string | null;
}

export function EstablishmentDrawer({
  establishmentId,
  open,
  onOpenChange,
  onUpdate,
}: EstablishmentDrawerProps) {
  const [establishment, setEstablishment] = useState<Establishment | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [parametrages, setParametrages] = useState<any>({
    groupes: [],
    secteurs: [],
    activites: [],
    concurrents: [],
  });

  // Contact form
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactForm, setContactForm] = useState({
    nom: "",
    prenom: "",
    fonction: "",
    telephone: "",
    email: "",
  });

  // Action form
  const [showActionForm, setShowActionForm] = useState(false);
  const [actionForm, setActionForm] = useState({
    type: "phoning" as const,
    date_action: new Date().toISOString().split("T")[0],
    statut_action: "a_venir" as const,
    commentaire: "",
    relance_date: "",
  });

  useEffect(() => {
    if (establishmentId && open) {
      fetchEstablishment();
      fetchContacts();
      fetchActions();
      fetchParametrages();
    }
  }, [establishmentId, open]);

  const fetchParametrages = async () => {
    const { data } = await supabase.from("parametrages").select("*");
    if (data) {
      const grouped = {
        groupes: data.filter((p) => p.categorie === "groupe"),
        secteurs: data.filter((p) => p.categorie === "secteur"),
        activites: data.filter((p) => p.categorie === "activite"),
        concurrents: data.filter((p) => p.categorie === "concurrent"),
      };
      setParametrages(grouped);
    }
  };

  const fetchEstablishment = async () => {
    if (!establishmentId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("establishments")
      .select("*")
      .eq("id", establishmentId)
      .single();

    if (error) {
      toast.error("Erreur lors du chargement");
    } else {
      setEstablishment(data);
    }
    setLoading(false);
  };

  const fetchContacts = async () => {
    if (!establishmentId) return;
    const { data, error } = await supabase
      .from("contacts")
      .select("*")
      .eq("etablissement_id", establishmentId)
      .eq("actif", true)
      .order("nom");

    if (!error && data) {
      setContacts(data);
    }
  };

  const fetchActions = async () => {
    if (!establishmentId) return;
    const { data, error } = await supabase
      .from("actions")
      .select("*, profiles(nom, prenom)")
      .eq("etablissement_id", establishmentId)
      .order("date_action", { ascending: false });

    if (!error && data) {
      setActions(data as any);
    }
  };

  const handleSaveEstablishment = async () => {
    if (!establishment || !establishmentId) return;
    setLoading(true);

    const { error } = await supabase
      .from("establishments")
      .update({
        nom: establishment.nom,
        statut: establishment.statut,
        adresse: establishment.adresse,
        code_postal: establishment.code_postal,
        ville: establishment.ville,
        commentaire: establishment.commentaire,
        info_concurrent: establishment.info_concurrent,
        groupe_id: establishment.groupe_id || null,
        secteur_id: establishment.secteur_id || null,
        activite_id: establishment.activite_id || null,
        concurrent_id: establishment.concurrent_id || null,
      })
      .eq("id", establishmentId);

    if (error) {
      toast.error("Erreur lors de la mise à jour");
    } else {
      toast.success("Établissement mis à jour");
      setEditMode(false);
      onUpdate();
    }
    setLoading(false);
  };

  const handleAddContact = async () => {
    if (!establishmentId) return;
    const { error } = await supabase.from("contacts").insert({
      etablissement_id: establishmentId,
      ...contactForm,
    });

    if (error) {
      toast.error("Erreur lors de l'ajout du contact");
    } else {
      toast.success("Contact ajouté");
      setContactForm({ nom: "", prenom: "", fonction: "", telephone: "", email: "" });
      setShowContactForm(false);
      fetchContacts();
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    const { error } = await supabase
      .from("contacts")
      .update({ actif: false })
      .eq("id", contactId);

    if (error) {
      toast.error("Erreur lors de la suppression");
    } else {
      toast.success("Contact supprimé");
      fetchContacts();
    }
  };

  const handleAddAction = async () => {
    if (!establishmentId) return;
    const { data: session } = await supabase.auth.getSession();
    if (!session.session?.user.id) return;

    const { error } = await supabase.from("actions").insert({
      etablissement_id: establishmentId,
      user_id: session.session.user.id,
      ...actionForm,
      relance_date: actionForm.relance_date || null,
    });

    if (error) {
      toast.error("Erreur lors de l'ajout de l'action");
    } else {
      toast.success("Action ajoutée");
      setActionForm({
        type: "phoning",
        date_action: new Date().toISOString().split("T")[0],
        statut_action: "a_venir",
        commentaire: "",
        relance_date: "",
      });
      setShowActionForm(false);
      fetchActions();
    }
  };

  const handleDeleteAction = async (actionId: string) => {
    const { error } = await supabase.from("actions").delete().eq("id", actionId);

    if (error) {
      toast.error("Erreur lors de la suppression");
    } else {
      toast.success("Action supprimée");
      fetchActions();
    }
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case "phoning":
        return <Phone className="h-4 w-4" />;
      case "mailing":
        return <Mail className="h-4 w-4" />;
      case "visite":
        return <MapPin className="h-4 w-4" />;
      case "rdv":
        return <Calendar className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getActionColor = (statut: string) => {
    switch (statut) {
      case "effectue":
        return "bg-client text-client-foreground";
      case "a_venir":
        return "bg-prospect text-prospect-foreground";
      case "a_relancer":
        return "bg-destructive text-destructive-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  if (!establishment) {
    return null;
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            {establishment.nom}
          </SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="info" className="mt-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="info">
              <Building2 className="h-4 w-4 mr-2" />
              Informations
            </TabsTrigger>
            <TabsTrigger value="contacts">
              <Users className="h-4 w-4 mr-2" />
              Contacts ({contacts.length})
            </TabsTrigger>
            <TabsTrigger value="actions">
              <ClipboardList className="h-4 w-4 mr-2" />
              Actions ({actions.length})
            </TabsTrigger>
          </TabsList>

          {/* Informations Tab */}
          <TabsContent value="info" className="space-y-4">
            <div className="flex items-center justify-between">
              <StatusBadge status={establishment.statut} />
              {!editMode ? (
                <Button size="sm" variant="outline" onClick={() => setEditMode(true)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Modifier
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditMode(false)}>
                    Annuler
                  </Button>
                  <Button size="sm" onClick={handleSaveEstablishment} disabled={loading}>
                    Enregistrer
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <Label>Nom</Label>
                <Input
                  value={establishment.nom}
                  onChange={(e) => setEstablishment({ ...establishment, nom: e.target.value })}
                  disabled={!editMode}
                />
              </div>

              <div>
                <Label>Statut</Label>
                <Select
                  value={establishment.statut}
                  onValueChange={(value: any) =>
                    setEstablishment({ ...establishment, statut: value })
                  }
                  disabled={!editMode}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prospect">Prospect</SelectItem>
                    <SelectItem value="client">Client</SelectItem>
                    <SelectItem value="ancien_client">Ancien client</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Groupe</Label>
                <Select
                  value={establishment.groupe_id || ""}
                  onValueChange={(value) =>
                    setEstablishment({ ...establishment, groupe_id: value || null })
                  }
                  disabled={!editMode}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Aucun" />
                  </SelectTrigger>
                  <SelectContent>
                    {parametrages.groupes.map((g: any) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.valeur}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Secteur</Label>
                <Select
                  value={establishment.secteur_id || ""}
                  onValueChange={(value) =>
                    setEstablishment({ ...establishment, secteur_id: value || null })
                  }
                  disabled={!editMode}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Aucun" />
                  </SelectTrigger>
                  <SelectContent>
                    {parametrages.secteurs.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.valeur}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Activité</Label>
                <Select
                  value={establishment.activite_id || ""}
                  onValueChange={(value) =>
                    setEstablishment({ ...establishment, activite_id: value || null })
                  }
                  disabled={!editMode}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Aucune" />
                  </SelectTrigger>
                  <SelectContent>
                    {parametrages.activites.map((a: any) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.valeur}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Adresse</Label>
                <Input
                  value={establishment.adresse || ""}
                  onChange={(e) =>
                    setEstablishment({ ...establishment, adresse: e.target.value })
                  }
                  disabled={!editMode}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Code postal</Label>
                  <Input
                    value={establishment.code_postal || ""}
                    onChange={(e) =>
                      setEstablishment({ ...establishment, code_postal: e.target.value })
                    }
                    disabled={!editMode}
                  />
                </div>
                <div>
                  <Label>Ville</Label>
                  <Input
                    value={establishment.ville || ""}
                    onChange={(e) =>
                      setEstablishment({ ...establishment, ville: e.target.value })
                    }
                    disabled={!editMode}
                  />
                </div>
              </div>

              <div>
                <Label>Concurrent</Label>
                <Select
                  value={establishment.concurrent_id || ""}
                  onValueChange={(value) =>
                    setEstablishment({ ...establishment, concurrent_id: value || null })
                  }
                  disabled={!editMode}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Aucun" />
                  </SelectTrigger>
                  <SelectContent>
                    {parametrages.concurrents.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.valeur}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Info concurrent</Label>
                <Textarea
                  value={establishment.info_concurrent || ""}
                  onChange={(e) =>
                    setEstablishment({ ...establishment, info_concurrent: e.target.value })
                  }
                  disabled={!editMode}
                />
              </div>

              <div>
                <Label>Commentaire</Label>
                <Textarea
                  value={establishment.commentaire || ""}
                  onChange={(e) =>
                    setEstablishment({ ...establishment, commentaire: e.target.value })
                  }
                  disabled={!editMode}
                />
              </div>
            </div>
          </TabsContent>

          {/* Contacts Tab */}
          <TabsContent value="contacts" className="space-y-4">
            <Button
              onClick={() => setShowContactForm(!showContactForm)}
              variant="outline"
              size="sm"
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Ajouter un contact
            </Button>

            {showContactForm && (
              <div className="p-4 border rounded-lg space-y-3 bg-muted/50">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Nom</Label>
                    <Input
                      value={contactForm.nom}
                      onChange={(e) =>
                        setContactForm({ ...contactForm, nom: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>Prénom</Label>
                    <Input
                      value={contactForm.prenom}
                      onChange={(e) =>
                        setContactForm({ ...contactForm, prenom: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div>
                  <Label>Fonction</Label>
                  <Input
                    value={contactForm.fonction}
                    onChange={(e) =>
                      setContactForm({ ...contactForm, fonction: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Téléphone</Label>
                  <Input
                    value={contactForm.telephone}
                    onChange={(e) =>
                      setContactForm({ ...contactForm, telephone: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={contactForm.email}
                    onChange={(e) =>
                      setContactForm({ ...contactForm, email: e.target.value })
                    }
                  />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAddContact}>
                    Enregistrer
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowContactForm(false)}
                  >
                    Annuler
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {contacts.map((contact) => (
                <div
                  key={contact.id}
                  className="p-3 border rounded-lg flex items-center justify-between hover:bg-muted/50"
                >
                  <div>
                    <div className="font-medium">
                      {contact.prenom} {contact.nom}
                    </div>
                    {contact.fonction && (
                      <div className="text-sm text-muted-foreground">{contact.fonction}</div>
                    )}
                    {contact.telephone && (
                      <div className="text-sm text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {contact.telephone}
                      </div>
                    )}
                    {contact.email && (
                      <div className="text-sm text-muted-foreground flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {contact.email}
                      </div>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteContact(contact.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
              {contacts.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                  Aucun contact
                </div>
              )}
            </div>
          </TabsContent>

          {/* Actions Tab */}
          <TabsContent value="actions" className="space-y-4">
            <Button
              onClick={() => setShowActionForm(!showActionForm)}
              variant="outline"
              size="sm"
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Ajouter une action
            </Button>

            {showActionForm && (
              <div className="p-4 border rounded-lg space-y-3 bg-muted/50">
                <div>
                  <Label>Type</Label>
                  <Select
                    value={actionForm.type}
                    onValueChange={(value: any) =>
                      setActionForm({ ...actionForm, type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="phoning">Phoning</SelectItem>
                      <SelectItem value="mailing">Mailing</SelectItem>
                      <SelectItem value="visite">Visite terrain</SelectItem>
                      <SelectItem value="rdv">Rendez-vous</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={actionForm.date_action}
                    onChange={(e) =>
                      setActionForm({ ...actionForm, date_action: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Statut</Label>
                  <Select
                    value={actionForm.statut_action}
                    onValueChange={(value: any) =>
                      setActionForm({ ...actionForm, statut_action: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="effectue">Effectué</SelectItem>
                      <SelectItem value="a_venir">À venir</SelectItem>
                      <SelectItem value="a_relancer">À relancer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Commentaire</Label>
                  <Textarea
                    value={actionForm.commentaire}
                    onChange={(e) =>
                      setActionForm({ ...actionForm, commentaire: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Date de relance (optionnelle)</Label>
                  <Input
                    type="date"
                    value={actionForm.relance_date}
                    onChange={(e) =>
                      setActionForm({ ...actionForm, relance_date: e.target.value })
                    }
                  />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAddAction}>
                    Enregistrer
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowActionForm(false)}
                  >
                    Annuler
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {actions.map((action) => (
                <div
                  key={action.id}
                  className="p-3 border rounded-lg space-y-2 hover:bg-muted/50"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className={getActionColor(action.statut_action)}>
                        {getActionIcon(action.type)}
                        <span className="ml-2 capitalize">{action.type}</span>
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {new Date(action.date_action).toLocaleDateString("fr-FR")}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteAction(action.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  {action.commentaire && (
                    <p className="text-sm">{action.commentaire}</p>
                  )}
                  {action.relance_date && (
                    <div className="text-xs text-muted-foreground">
                      Relance prévue le{" "}
                      {new Date(action.relance_date).toLocaleDateString("fr-FR")}
                    </div>
                  )}
                  {action.profiles && (
                    <div className="text-xs text-muted-foreground">
                      Par {action.profiles.prenom} {action.profiles.nom}
                    </div>
                  )}
                </div>
              ))}
              {actions.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                  Aucune action
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
