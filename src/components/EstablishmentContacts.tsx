// components/EstablishmentContacts.tsx
import { useState } from "react";
import { Users, User, Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface EstablishmentContactsProps {
  contacts: any[];
  onAddContact: (contact: any) => Promise<void>;
}

const EstablishmentContacts = ({ contacts = [], onAddContact }: EstablishmentContactsProps) => {
  const [showAddContact, setShowAddContact] = useState(false);
  const [addingContact, setAddingContact] = useState(false);
  const [newContact, setNewContact] = useState({
    nom: "",
    prenom: "",
    fonction: "",
    telephone: "",
    email: ""
  });

  const handleAddContact = async () => {
    if (!newContact.nom || !newContact.prenom) return;

    setAddingContact(true);
    await onAddContact(newContact);
    setNewContact({ nom: "", prenom: "", fonction: "", telephone: "", email: "" });
    setShowAddContact(false);
    setAddingContact(false);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2 text-lg">
          <Users className="h-5 w-5 text-[#840404]" />
          Contacts
        </h3>
        <Button
          size="sm"
          onClick={() => setShowAddContact(true)}
          className="gap-2 bg-[#840404] hover:bg-[#730303]"
        >
          <User className="h-4 w-4" />
          Ajouter un contact
        </Button>
      </div>

      {showAddContact && (
        <div className="bg-slate-50 rounded-lg p-4 mb-4 border border-slate-200">
          <h4 className="font-medium text-slate-900 mb-3">Nouveau contact</h4>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder="Nom"
                value={newContact.nom}
                onChange={(e) => setNewContact({...newContact, nom: e.target.value})}
              />
              <Input
                placeholder="Prénom"
                value={newContact.prenom}
                onChange={(e) => setNewContact({...newContact, prenom: e.target.value})}
              />
            </div>
            <Input
              placeholder="Fonction"
              value={newContact.fonction}
              onChange={(e) => setNewContact({...newContact, fonction: e.target.value})}
            />
            <Input
              placeholder="Téléphone"
              value={newContact.telephone}
              onChange={(e) => setNewContact({...newContact, telephone: e.target.value})}
            />
            <Input
              placeholder="Email"
              type="email"
              value={newContact.email}
              onChange={(e) => setNewContact({...newContact, email: e.target.value})}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAddContact} disabled={addingContact}>
                {addingContact ? "Ajout..." : "Ajouter"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowAddContact(false)}>
                Annuler
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3 max-h-60 overflow-y-auto">
        {contacts && contacts.map((contact) => (
          <div key={contact.id} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="font-semibold text-slate-900 text-lg">
                  {contact.prenom} {contact.nom}
                </div>
                {contact.fonction && (
                  <div className="text-sm text-slate-600 mt-1">{contact.fonction}</div>
                )}
                <div className="flex items-center gap-4 mt-3 text-sm">
                  {contact.telephone && (
                    <div className="flex items-center gap-2 text-slate-700">
                      <Phone className="h-4 w-4" />
                      {contact.telephone}
                    </div>
                  )}
                  {contact.email && (
                    <div className="flex items-center gap-2 text-slate-700">
                      <Mail className="h-4 w-4" />
                      {contact.email}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
        {(!contacts || contacts.length === 0) && !showAddContact && (
          <div className="text-center text-slate-500 py-8 border-2 border-dashed border-slate-200 rounded-lg">
            <Users className="h-8 w-8 text-slate-400 mx-auto mb-2" />
            <p>Aucun contact</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default EstablishmentContacts;