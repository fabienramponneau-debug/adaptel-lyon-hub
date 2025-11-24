// src/utils/geoApi.ts

export interface CitySuggestion {
  nom: string;
  code_postal: string;
}

/**
 * Recherche de villes / communes françaises
 * - Si query = code postal (5 chiffres) -> on filtre par codePostal
 * - Sinon -> recherche par nom
 *
 * On renvoie toujours { nom, code_postal } en gardant le CP saisi
 * quand on est en mode "codePostal" (ex: 69007 pour Lyon 7).
 */
export async function searchCitySuggestions(
  query: string
): Promise<CitySuggestion[]> {
  const q = query.trim();
  if (!q) return [];

  const isPostal = /^\d{5}$/.test(q);

  try {
    let url = "";

    if (isPostal) {
      // Recherche par code postal exact
      url =
        "https://geo.api.gouv.fr/communes?" +
        new URLSearchParams({
          codePostal: q,
          fields: "nom,codesPostaux",
          boost: "population",
          limit: "20",
        }).toString();
    } else {
      // Recherche par nom de commune
      url =
        "https://geo.api.gouv.fr/communes?" +
        new URLSearchParams({
          nom: q,
          fields: "nom,codesPostaux",
          boost: "population",
          limit: "20",
        }).toString();
    }

    const res = await fetch(url);
    if (!res.ok) {
      console.error("geoApi searchCitySuggestions error", res.status);
      return [];
    }

    const data = (await res.json()) as Array<{
      nom: string;
      codesPostaux?: string[];
    }>;

    if (!Array.isArray(data)) return [];

    const suggestions: CitySuggestion[] = [];

    for (const commune of data) {
      const codes = commune.codesPostaux ?? [];

      if (isPostal) {
        // 👉 Tu as saisi un CP précis (ex: 69007)
        // Si la commune contient ce CP, on le garde tel quel
        if (codes.includes(q)) {
          suggestions.push({
            nom: commune.nom, // "Lyon 7e Arrondissement" si l'API renvoie ça
            code_postal: q,   // ⚠️ on garde EXACTEMENT 69007
          });
        } else if (codes.length > 0) {
          // Cas dégradé : par sécurité, on propose quand même le 1er CP
          suggestions.push({
            nom: commune.nom,
            code_postal: codes[0],
          });
        }
      } else {
        // Recherche par nom : on renvoie une entrée par CP
        for (const cp of codes) {
          suggestions.push({
            nom: commune.nom,
            code_postal: cp,
          });
        }
      }
    }

    // On évite les doublons (même ville + CP)
    const unique = new Map<string, CitySuggestion>();
    for (const s of suggestions) {
      const key = `${s.nom}-${s.code_postal}`;
      if (!unique.has(key)) unique.set(key, s);
    }

    return Array.from(unique.values());
  } catch (e) {
    console.error("geoApi searchCitySuggestions exception", e);
    return [];
  }
}

/**
 * Géocodage d'une adresse (API Adresse officielle)
 * On utilise adresse + CP + ville si dispo.
 */
export async function geocodeAddress(
  adresse: string | null,
  code_postal: string | null,
  ville: string | null
): Promise<{ latitude: number; longitude: number } | null> {
  const parts: string[] = [];

  if (adresse && adresse.trim()) parts.push(adresse.trim());
  if (code_postal && code_postal.trim()) parts.push(code_postal.trim());
  if (ville && ville.trim()) parts.push(ville.trim());

  if (parts.length === 0) return null;

  const q = parts.join(" ");

  try {
    const url =
      "https://api-adresse.data.gouv.fr/search/?" +
      new URLSearchParams({
        q,
        limit: "1",
      }).toString();

    const res = await fetch(url);
    if (!res.ok) {
      console.error("geoApi geocodeAddress error", res.status);
      return null;
    }

    const data = await res.json();

    if (!data.features || !data.features.length) return null;

    const feature = data.features[0];
    if (
      !feature.geometry ||
      !Array.isArray(feature.geometry.coordinates) ||
      feature.geometry.coordinates.length < 2
    ) {
      return null;
    }

    const [lon, lat] = feature.geometry.coordinates;
    return {
      latitude: lat,
      longitude: lon,
    };
  } catch (e) {
    console.error("geoApi geocodeAddress exception", e);
    return null;
  }
}
