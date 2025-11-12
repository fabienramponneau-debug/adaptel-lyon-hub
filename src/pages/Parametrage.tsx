import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings } from "lucide-react";

const Parametrage = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Paramétrage</h1>
        <p className="text-muted-foreground">Gérez les listes et paramètres de l'application</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Groupes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Gérez les groupes d'établissements</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Secteurs</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Gérez les secteurs d'activité</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Activités</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Gérez les types d'activités</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Concurrents</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Gérez la liste des concurrents</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Parametrage;
