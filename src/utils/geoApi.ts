// src/utils/geoApi.ts

// Interface utilisée dans tout ton projet
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
  if (!trimmed) return [];

  const isZip = trimmed.length >= 2 && /^\d+$/.test(trimmed);

  const url = `https://geo.api.gouv.fr/communes?${
    isZip ? "codePostal" : "nom"
  }=${encodeURIComponent(trimmed)}&fields=nom,codesPostaux&format=json&limit=5`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(
        "Erreur API geo.api.gouv.fr:",
        res.status,
        res.statusText
      );
      return [];
    }

    const data = await res.json();

    if (Array.isArray(data)) {
      return data
        .map((item: any) => {
          const cp = Array.isArray(item.codesPostaux)
            ? item.codesPostaux[0]
            : "";

          if (!cp) return null;

          return {
            code_postal: cp,
            nom: item.nom as string,
          } as CitySuggestion;
        })
        .filter(Boolean) as CitySuggestion[];
    }
  } catch (e) {
    console.error("Erreur réseau API geo.api.gouv.fr:", e);
  }

  return [];
}

/**
 * Convertit une adresse complète en coordonnées GPS (latitude / longitude)
 * via Nominatim (OpenStreetMap).
 *
 * @param adresse L'adresse (rue, numéro)
 * @param code_postal Le code postal
 * @param ville La ville
 * @returns { latitude, longitude } ou null si échec
 */
export async function geocodeAddress(
  adresse: string | null,
  code_postal: string | null,
  ville: string | null
): Promise<{ latitude: number; longitude: number } | null> {
  const query = [adresse, code_postal, ville].filter(Boolean).join(", ");

  if (!query) return null;

  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
    query
  )}&format=json&limit=1&addressdetails=0`;

  try {
    const res = await fetch(url, {
      headers: {
        // Nominatim demande un User-Agent explicite
        "User-Agent": "ADAPTEL-Lyon-CRM/1.0 (contact: agence-lyon)",
      },
    });

    if (!res.ok) {
      console.error(
        "Erreur API Nominatim:",
        res.status,
        res.statusText
      );
      return null;
    }

    const data = await res.json();

    if (Array.isArray(data) && data.length > 0) {
      const result = data[0];
      const lat = parseFloat(result.lat);
      const lon = parseFloat(result.lon);

      if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
        return { latitude: lat, longitude: lon };
      }
    }
  } catch (e) {
    console.error("Erreur réseau API Nominatim:", e);
  }

  return null;
}
