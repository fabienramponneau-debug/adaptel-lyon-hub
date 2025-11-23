// src/utils/geoApi.ts

export interface CitySuggestion {
  code_postal: string;
  nom: string;
}

/**
 * Recherche de villes / codes postaux via l'API officielle geo.api.gouv.fr
 * - Si l'utilisateur tape un code postal (2 à 5 chiffres) => recherche par codePostal
 * - Sinon => recherche par nom de commune
 */
export async function searchCitySuggestions(
  query: string
): Promise<CitySuggestion[]> {
  const trimmed = query.trim();

  if (trimmed.length < 2) {
    return [];
  }

  const isCp = /^[0-9]{2,5}$/.test(trimmed);

  const url = isCp
    ? `https://geo.api.gouv.fr/communes?codePostal=${encodeURIComponent(
        trimmed
      )}&fields=nom,codesPostaux&format=json&geometry=centre`
    : `https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(
        trimmed
      )}&fields=nom,codesPostaux&format=json&geometry=centre`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error("Erreur API GEO:", res.status, res.statusText);
      return [];
    }

    const data = await res.json();

    const suggestions: CitySuggestion[] = [];

    (data || []).forEach((commune: any) => {
      const nom = commune.nom as string;
      const cps: string[] = commune.codesPostaux || [];

      cps.forEach((cp) => {
        // Si on tape un CP, on filtre grossièrement sur le début
        if (!isCp || cp.startsWith(trimmed)) {
          suggestions.push({
            code_postal: cp,
            nom,
          });
        }
      });
    });

    // Déduplication simple ville + code postal
    const seen = new Set<string>();
    const unique = suggestions.filter((s) => {
      const key = `${s.nom}-${s.code_postal}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // On limite à 15 entrées pour rester lisible
    return unique.slice(0, 15);
  } catch (e) {
    console.error("Erreur réseau API GEO:", e);
    return [];
  }
}
