import { lazy, Suspense, useRef, useState } from "react";
import { ErrorBox, Loading } from "./Bits";
import type { Town } from "../lib/types";

const TownMap = lazy(() => import("./TownMap").then((m) => ({ default: m.TownMap })));

const SEEN = "lj-map-gesture";

export function MapBoard({ town, error, loading }: { town: Town | null; error: Error | null; loading: boolean }) {
  const [hint, setHint] = useState(false);
  const shown = useRef(false);
  const interact = () => {
    if (shown.current || hint) return;
    if (window.matchMedia("(min-width: 721px)").matches) return;
    if (localStorage.getItem(SEEN) === "1") return;
    shown.current = true;
    localStorage.setItem(SEEN, "1");
    setHint(true);
    window.setTimeout(() => setHint(false), 1600);
  };
  return (
    <section id="map" className="map-board" aria-label="龍角鎮地圖">
      <ErrorBox error={error} />
      {loading && !town ? <Loading /> : town && (
        <Suspense fallback={<Loading />}>
          <TownMap districts={town.districts} places={town.places} onInteract={interact} />
        </Suspense>
      )}
      {hint && <div className="gesture-hint" aria-hidden><span>👆</span></div>}
    </section>
  );
}
