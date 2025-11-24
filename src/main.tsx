// src/main.tsx

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "leaflet/dist/leaflet.css"; // ✅ CSS Leaflet pour l'affichage de la carte

createRoot(document.getElementById("root")!).render(<App />);
