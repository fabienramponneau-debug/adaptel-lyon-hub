// src/pages/Map.tsx

import { Map as MapIcon } from "lucide-react";

const MapPage = () => {
  // Centre Lyon
  const lat = 45.7578;
  const lng = 4.832;
  const zoom = 12;

  // BBox approximative autour de Lyon pour l'embed OSM
  const deltaLat = 0.12;
  const deltaLng = 0.18;
  const minLat = lat - deltaLat;
  const maxLat = lat + deltaLat;
  const minLng = lng - deltaLng;
  const maxLng = lng + deltaLng;

  const bbox = `${minLng},${minLat},${maxLng},${maxLat}`;
  const marker = `${lat}%2C${lng}`;

  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${marker}`;

  return (
    <div className="space-y-6 flex flex-col h-[calc(100vh-100px)]">
      {/* Header uniforme */}
      <div className="flex flex-col gap-2 mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#840404]/10 rounded-lg">
            <MapIcon className="h-6 w-6 text-[#840404]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Carte des Établissements
            </h1>
            <p className="text-slate-600 text-sm">
              Visualisation géographique (version simple – on branchera les établissements ensuite).
            </p>
          </div>
        </div>
      </div>

      {/* Conteneur carte */}
      <div className="flex-1 min-h-0 relative rounded-lg overflow-hidden border border-slate-200 shadow-sm">
        <iframe
          title="Carte des établissements"
          src={src}
          style={{ border: 0 }}
          className="w-full h-full"
          loading="lazy"
        />
      </div>
    </div>
  );
};

export default MapPage;
