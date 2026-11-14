import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import { Link } from "@tanstack/react-router";
import type { ProviderResult } from "@/lib/scheduling";

export default function ProviderMap({ results, center }: { results: ProviderResult[]; center: { lat: number; lng: number } | null }) {
  const pts = results.filter((r) => r.in_person);
  const c = center ?? (pts[0] ? { lat: pts[0].lat, lng: pts[0].lng } : { lat: -23.55, lng: -46.63 });
  return (
    <MapContainer center={[c.lat, c.lng]} zoom={12} scrollWheelZoom className="h-[480px] w-full rounded-2xl border" aria-label="Mapa dos profissionais">
      <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap contributors" />
      {center && <CircleMarker center={[center.lat, center.lng]} radius={7} pathOptions={{ className: "fill-muted-foreground stroke-muted-foreground", fillOpacity: 0.6 }}><Popup>Região aproximada da busca</Popup></CircleMarker>}
      {pts.map((r) => (
        <CircleMarker key={r.id} center={[r.lat, r.lng]} radius={10} pathOptions={{ className: r.acceptsMyPlan ? "fill-success stroke-success" : "fill-warning stroke-warning", fillOpacity: 0.85 }}>
          <Popup>
            <strong>{r.name}</strong><br />{r.specialties.join(", ")}<br />{r.distanceKm != null && `${r.distanceKm.toFixed(1)} km · `}
            <Link to="/consultas/$providerId" params={{ providerId: r.id }} search={{ remarcar: undefined }}>Ver horários</Link>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
