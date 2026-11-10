import { Link } from "react-router-dom";
import { MapBoard } from "../components/MapBoard";
import type { Town } from "../lib/types";
import { useFetch } from "../lib/useFetch";

export function MapPage() {
  const town = useFetch<Town>("/api/town");
  return (
    <div className="stack">
      <h1>地圖</h1>
      <Link to="/places/pub_music" className="btn primary">去音樂坊小廣場</Link>
      <MapBoard town={town.data} error={town.error} loading={town.loading} />
    </div>
  );
}
