// src/pages/Map.tsx

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Map as MapIcon, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import MapEstablishmentModal from "@/components/MapEstablishmentModal";

type EstablishmentStatus = "prospect" | "client" | "ancien_client";

interface Establishment {
  id: string;
  nom: string;
  statut: EstablishmentStatus;
  latitude: number | null;
  longitude: number | null;
  ville: string | null;
  adresse: string | null;
  code_postal: string | null;
}

type StatusFilter = "all" | EstablishmentStatus;

const MapPage = () => {
  const defaultCenter: [number, number] = [45.7578, 4.832];
  const defaultZoom = 12;

  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  const escapeHtml = (str: string): string =>
    str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  // Init Leaflet
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapRef.current) return;

    const map = L.map(mapContainerRef.current).setView(defaultCenter, defaultZoom);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Load establishments with coords
  const fetchEstablishments = useCallback(async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("establishments")
      .select(
        "id, nom, statut, latitude, longitude, ville, adresse, code_postal"
      )
      .not("latitude", "is", null)
      .not("longitude", "is", null);

    if (error) {
      console.error("Erreur chargement établissements pour la carte :", error);
      setEstablishments([]);
      setLoading(false);
      return;
    }

    const items: Establishment[] = (data || []).map((e: any) => ({
      id: e.id as string,
      nom: e.nom as string,
      statut: e.statut as EstablishmentStatus,
      latitude: e.latitude as number | null,
      longitude: e.longitude as number | null,
      ville: (e.ville as string | null) ?? null,
      adresse: (e.adresse as string | null) ?? null,
      code_postal: (e.code_postal as string | null) ?? null,
    }));

    setEstablishments(items);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchEstablishments();
  }, [fetchEstablishments]);

  // Filter + search
  const filteredEstablishments = useMemo(() => {
    return establishments.filter((e) => {
      if (!e.latitude || !e.longitude) return false;

      if (statusFilter !== "all" && e.statut !== statusFilter) {
        return false;
      }

      if (searchTerm.trim().length > 0) {
        const q = searchTerm.trim().toLowerCase();
        const nameMatch = e.nom.toLowerCase().includes(q);
        const cityMatch = (e.ville || "").toLowerCase().includes(q);
        return nameMatch || cityMatch;
      }

      return true;
    });
  }, [establishments, statusFilter, searchTerm]);

  // Colors par statut
  const getStatusColor = (statut: EstablishmentStatus): string => {
    switch (statut) {
      case "client":
        return "#16a34a"; // vert
      case "prospect":
        return "#f97316"; // orange
      case "ancien_client":
        return "#6b7280"; // gris
      default:
        return "#6b7280";
    }
  };

  const getStatusLabel = (statut: EstablishmentStatus): string => {
    switch (statut) {
      case "client":
        return "Client actuel";
      case "prospect":
        return "Prospect";
      case "ancien_client":
        return "Ancien client";
      default:
        return statut;
    }
  };

  // Étiquette moderne avec trait
  const createLabelIcon = (e: Establishment): L.DivIcon => {
    const color = getStatusColor(e.statut);
    const label =
      e.nom.length > 22 ? `${e.nom.slice(0, 21)}…` : e.nom;

    const html = `
      <div style="display:flex;flex-direction:column;align-items:center;pointer-events:auto;">
        <div
          style="
            padding: 4px 10px;
            border-radius: 6px;
            background: ${color};
            color: white;
            font-size: 11px;
            font-weight: 600;
            white-space: nowrap;
            max-width: 220px;
            text-overflow: ellipsis;
            overflow: hidden;
            box-shadow: 0 4px 8px rgba(0,0,0,0.35);
            border: 1px solid rgba(255,255,255,0.8);
          "
        >
          ${escapeHtml(label)}
        </div>
        <div
          style="
            width: 2px;
            height: 12px;
            background: ${color};
            margin-top: 2px;
          "
        ></div>
        <div
          style="
            width: 0;
            height: 0;
            border-left: 6px solid transparent;
            border-right: 6px solid transparent;
            border-top: 10px solid ${color};
          "
        ></div>
      </div>
    `;

    return L.divIcon({
      html,
      className: "",
      iconSize: [34, 46],
      iconAnchor: [17, 46],
    });
  };

  // Maj des marqueurs + popup HTML propre
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    if (markersLayerRef.current) {
      markersLayerRef.current.clearLayers();
      map.removeLayer(markersLayerRef.current);
    }

    const layer = L.layerGroup().addTo(map);
    markersLayerRef.current = layer;

    if (filteredEstablishments.length === 0) {
      map.setView(defaultCenter, defaultZoom);
      return;
    }

    const bounds: L.LatLngExpression[] = [];

    filteredEstablishments.forEach((e) => {
      if (e.latitude == null || e.longitude == null) return;

      const icon = createLabelIcon(e);
      const marker = L.marker([e.latitude, e.longitude], {
        icon,
        riseOnHover: true,
      });

      const color = getStatusColor(e.statut);
      const statusLabel = getStatusLabel(e.statut);

      // Adresse complète
      const addressLines: string[] = [];
      if (e.adresse) {
        addressLines.push(escapeHtml(e.adresse));
      }
      const cityParts: string[] = [];
      if (e.code_postal) cityParts.push(escapeHtml(e.code_postal));
      if (e.ville) cityParts.push(escapeHtml(e.ville));
      if (cityParts.length) {
        addressLines.push(cityParts.join(" "));
      }

      const addressHtml =
        addressLines.length > 0
          ? `<div style="color:#4b5563;font-size:12px;margin-top:2px;line-height:1.3;">
               ${addressLines.join("<br/>")}
             </div>`
          : "";

      const popupHtml =
        `<div style="font-size:13px;min-width:180px;max-width:240px;">` +
        `<div style="font-weight:600;margin-bottom:2px;">${escapeHtml(
          e.nom
        )}</div>` +
        addressHtml +
        `<div style="margin-top:6px;display:inline-flex;align-items:center;gap:6px;font-size:11px;">
           <span style="width:8px;height:8px;border-radius:999px;background:${color};display:inline-block;"></span>
           <span style="color:#374151;">${statusLabel}</span>
         </div>` +
        `<button 
            type="button"
            data-open-prospect="${e.id}"
            style="
              margin-top:10px;
              padding:6px 10px;
              width:100%;
              font-size:12px;
              border-radius:999px;
              border:none;
              cursor:pointer;
              background:#111827;
              color:white;
            "
        >
          Fiche client
        </button>` +
        `</div>`;

      marker.bindPopup(popupHtml);

      marker.on("popupopen", (event) => {
        const popupEl = event.popup.getElement() as HTMLElement | null;
        if (!popupEl) return;

        const btn = popupEl.querySelector(
          `[data-open-prospect="${e.id}"]`
        ) as HTMLButtonElement | null;

        if (btn) {
          btn.onclick = () => {
            setSelectedId(e.id);
            setModalOpen(true);
          };
        }
      });

      marker.addTo(layer);
      bounds.push([e.latitude, e.longitude]);
    });

    if (bounds.length > 0) {
      const latLngBounds = L.latLngBounds(bounds);
      map.fitBounds(latLngBounds, { padding: [50, 50] });
    } else {
      map.setView(defaultCenter, defaultZoom);
    }
  }, [filteredEstablishments, defaultCenter, defaultZoom]);

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedId(null);
  };

  return (
    <div className="space-y-6 flex flex-col h-[calc(100vh-100px)]">
      {/* Header */}
      <div className="flex flex-col gap-2 mb-2">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#840404]/10 rounded-lg">
            <MapIcon className="h-6 w-6 text-[#840404]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Carte des Établissements
            </h1>
            <p className="text-slate-600 text-sm">
              Visualisation géographique avec filtres, recherche et prospection rapide.
            </p>
          </div>
        </div>
      </div>

      {/* Filtres & recherche */}
      <Card className="border border-slate-200 shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-slate-700">Afficher :</span>

          <Button
            size="sm"
            variant={statusFilter === "all" ? "default" : "outline"}
            onClick={() => setStatusFilter("all")}
            className="h-8 text-xs"
          >
            Tous ({establishments.length})
          </Button>

          <Button
            size="sm"
            variant={statusFilter === "prospect" ? "default" : "outline"}
            onClick={() => setStatusFilter("prospect")}
            className="h-8 text-xs"
          >
            Prospects
          </Button>

          <Button
            size="sm"
            variant={statusFilter === "client" ? "default" : "outline"}
            onClick={() => setStatusFilter("client")}
            className="h-8 text-xs"
          >
            Clients
          </Button>

          <Button
            size="sm"
            variant={statusFilter === "ancien_client" ? "default" : "outline"}
            onClick={() => setStatusFilter("ancien_client")}
            className="h-8 text-xs"
          >
            Anciens clients
          </Button>

          <div className="ml-auto flex items-center gap-2 min-w-[220px]">
            <Input
              placeholder="Rechercher (nom ou ville)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 text-sm"
            />
            {loading && (
              <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
            )}
          </div>
        </div>
      </Card>

      {/* Carte */}
      <div className="flex-1 min-h-0 relative rounded-lg overflow-hidden border border-slate-200 shadow-sm">
        <div ref={mapContainerRef} className="w-full h-full" />
      </div>

      {/* Modale de prospection / fiche "light" */}
      <MapEstablishmentModal
        establishmentId={selectedId}
        open={modalOpen}
        onClose={handleCloseModal}
      />
    </div>
  );
};

export default MapPage;
