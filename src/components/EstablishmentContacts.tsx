import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Users, User, Mail, Phone } from "lucide-react";

interface Contact { id: string; nom: string; prenom: string; fonction: string | null; telephone: string | null; email: string | null; }
interface Props { contacts: Contact[]; establishmentId: string | null; onContactsUpdate: () => void; }

export default function EstablishmentContacts({ contacts, establishmentId, onContactsUpdate }: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ nom: "", prenom: "", fonction: "", telephone: "", email: "" });

  async function add() {
    if (!establishmentId || !form.nom || !form.prenom) return;
    setSaving(true);
    const { error } = await supabase.from("contacts").insert([{
      etablissement_id: establishmentId, nom: form.nom, prenom: form.prenom,
      fonction: form.fonction || null, telephone: form.telephone || null, email: form.email || null
    }]);
    setSaving(false);
    if (!error) { setForm({ nom:"", prenom:"", fonction:"", telephone:"", email:"" }); setShowAdd(false); onContactsUpdate(); }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2 text-[15px]"><Users className="h-5 w-5 text-[#840404]"/> Contacts</h3>
        <Button size="sm" onClick={()=>setShowAdd(true)} className="gap-2 bg-[#840404] hover:bg-[#730303]">
          <User className="h-4 w-4"/> Ajouter
        </Button>
      </div>

      {showAdd && (
        <div className="bg-slate-50 rounded-lg p-4 mb-4 border border-slate-200">
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="Nom" value={form.nom} onChange={e=>setForm({...form, nom: e.target.value})}/>
            <Input placeholder="Prénom" value={form.prenom} onChange={e=>setForm({...form, prenom: e.target.value})}/>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <Input placeholder="Fonction" value={form.fonction} onChange={e=>setForm({...form, fonction: e.target.value})}/>
            <Input placeholder="Téléphone" value={form.telephone} onChange={e=>setForm({...form, telephone: e.target.value})}/>
          </div>
          <Input className="mt-3" placeholder="Email" type="email" value={form.email} onChange={e=>setForm({...form, email: e.target.value})}/>
          <div className="flex gap-2 mt-3">
            <Button size="sm" onClick={add} disabled={saving}>{saving ? "Ajout…" : "Ajouter"}</Button>
            <Button variant="outline" size="sm" onClick={()=>setShowAdd(false)}>Annuler</Button>
          </div>
        </div>
      )}

      <div className="space-y-3 max-h-60 overflow-y-auto">
        {contacts.map(c => (
          <div key={c.id} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <div className="font-medium text-slate-900">{c.prenom} {c.nom}</div>
            {c.fonction && <div className="text-sm text-slate-600 mt-1">{c.fonction}</div>}
            <div className="flex items-center gap-4 mt-3 text-sm">
              {c.telephone && <div className="flex items-center gap-2 text-slate-700"><Phone className="h-4 w-4"/>{c.telephone}</div>}
              {c.email && <div className="flex items-center gap-2 text-slate-700"><Mail className="h-4 w-4"/>{c.email}</div>}
            </div>
          </div>
        ))}
        {contacts.length===0 && !showAdd && (
          <div className="text-center text-slate-500 py-8 border-2 border-dashed border-slate-200 rounded-lg">
            <Users className="h-8 w-8 text-slate-400 mx-auto mb-2"/><p>Aucun contact</p>
          </div>
        )}
      </div>
    </div>
  );
}
