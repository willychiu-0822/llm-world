import { MapBoard } from "../components/MapBoard";
import type { Town } from "../lib/types";
import { useFetch } from "../lib/useFetch";

export function MapPage() {
  const town = useFetch<Town>("/api/town");
  return (
    <div className="stack">
      <h1>地圖</h1>
      <MapBoard town={town.data} error={town.error} loading={town.loading} />
    </div>
  );
}
