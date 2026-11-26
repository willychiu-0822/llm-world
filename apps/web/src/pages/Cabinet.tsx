import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ErrorBox, Loading } from "../components/Bits";
import { CabinetView } from "../components/CabinetView";
import { LifeShelf } from "../components/LifeShelf";
import { acceptKeepsake } from "../lib/keepsake";
import { useSession } from "../lib/session";
import type { KeepsakeItem } from "../lib/types";
import { useFetch } from "../lib/useFetch";

interface Dex {
  collected: number;
  total: number;
  items: KeepsakeItem[];
}

export function CabinetPage() {
  const { hash } = useLocation();
  const { me, reload } = useSession();
  const nav = useNavigate();
  const { data, error, loading } = useFetch<Dex>("/api/me/keepsakes");
  useEffect(() => {
    const id = hash === "#life" || hash === "#keepsakes" ? hash.slice(1) : "";
    if (!id) return;
    const scroll = () => document.getElementById(id)?.scrollIntoView({ block: "start" });
    scroll();
    // Keepsakes arrive after the first paint and push the life section down.
    const frame = requestAnimationFrame(scroll);
    return () => cancelAnimationFrame(frame);
  }, [hash, loading]);
  const accept = async (item: KeepsakeItem) => {
    await acceptKeepsake(item);
    await reload();
    nav("/tries", { state: { hello: true } });
  };
  return (
    <div className="stack cabinet">
      <header className="stack" style={{ gap: 8 }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h1>收藏櫃</h1>
          <Link to="/" className="btn ghost">
            回小龍身邊
          </Link>
        </div>
        <p className="muted">鎮民的信物，和小龍帶回來的，都收在這裡。</p>
      </header>
      {loading && !data ? (
        <section id="keepsakes" className="stack cabinet-layer" aria-labelledby="town-keepsakes">
          <h2 id="town-keepsakes">鎮民的信物</h2>
          <Loading />
        </section>
      ) : error ? (
        <section id="keepsakes" className="stack cabinet-layer" aria-labelledby="town-keepsakes">
          <h2 id="town-keepsakes">鎮民的信物</h2>
          <ErrorBox error={error} />
        </section>
      ) : data ? (
        <CabinetView
          collected={data.collected}
          total={data.total}
          items={data.items}
          pendingId={me?.pet?.pending?.deedId}
          onAccept={accept}
        />
      ) : null}
      <LifeShelf />
    </div>
  );
}
