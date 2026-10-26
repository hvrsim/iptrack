import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

type LocationPoint = { id: string; lat: number; lng: number; ipAddress: string; visitedAt: Date; mobile: boolean | null };
export default function TrafficMap({ points }: { points: LocationPoint[] }) {
  return <div className="h-[320px] w-full"><MapContainer center={[20, 0]} zoom={2} minZoom={2} maxZoom={12} scrollWheelZoom className="h-full w-full">
    <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
    {points.map(point => <CircleMarker key={point.id} center={[point.lat, point.lng]} radius={5}>
      <Popup>{point.ipAddress}<br />{point.visitedAt.toLocaleString()}<br />Mobile: {point.mobile === null ? "Unknown" : point.mobile ? "Yes" : "No"}</Popup>
    </CircleMarker>)}
  </MapContainer></div>;
}
