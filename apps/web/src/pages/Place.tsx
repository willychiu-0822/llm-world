import { dedupeKeepsakes, joinWords, keepsakeFor, townFolk, warmLine } from "@lj/core";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Dialog } from "../components/Dialog";
import { ErrorBox, Loading } from "../components/Bits";
import { timeAgo } from "../lib/format";
import { acceptKeepsake } from "../lib/keepsake";
import { useSession } from "../lib/session";
import type { Deed, Trial } from "../lib/types";
import { useFetch } from "../lib/useFetch";

interface PlaceView {
  id: string;
  kind: "public" | "shop";
  districtKey: string;
  name: string;
  description: string;
  realAddress: string | null;
  online: boolean;
  isDemo: boolean;
  providerName: string | null;
  deeds: Deed[];
  trials: Trial[];
}

function uniqueKeepsakes(deeds: Deed[]) {
  const tagged = deeds.map((deed) => ({ deed, who: deed.character?.name ?? "", title: deed.title }));
  return dedupeKeepsakes(tagged).slice(0, 3).map((item) => item.deed);
}

export function PlacePage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { me } = useSession();
  const { data, error, loading } = useFetch<PlaceView>(`/api/places/${id}`);
  const [open, setOpen] = useState<Deed | null>(null);
  const [busy, setBusy] = useState(false);
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  if (!data) return null;
  const folk = townFolk(data.districtKey);
  const keepsakes = uniqueKeepsakes(data.deeds);
  const grown = (me?.pet?.stage ?? 0) >= 2;
  const accept = async (deed: Deed) => {
    if (!me) {
      nav(`/login?next=${encodeURIComponent(`/places/${data.id}`)}`);
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      await acceptKeepsake({ deedId: deed.id, title: deed.title, object: keepsakeFor(deed.districtKey).name });
      nav("/tries", { state: { hello: true } });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="stack">
      <section className="panel hero stack" style={{ gap: 6 }}>
        <h1>{data.name}</h1>
        {data.kind === "shop" && data.providerName && <p>{joinWords(data.providerName, "的小店")}</p>}
        <p><strong>{folk.name}</strong>：「{folk.line}」</p>
        {data.description && <p className="muted">{data.description}</p>}
        {data.kind === "shop" && <p>{data.online ? "線上見" : data.realAddress ? `📍 ${data.realAddress}` : ""}</p>}
      </section>
      {grown && data.trials.length > 0 && (
        <section className="stack">
          <h2>可以來玩的</h2>
          <div className="stack">
            {data.trials.map((t) => (
              <Link key={t.id} to={`/trials/${t.id}`} className="card-link">
                <div className="panel stack" style={{ gap: 4 }}>
                  <strong>{t.title}</strong>
                  <small>{t.durationMin} 分鐘{t.whenText ? `・${t.whenText}` : ""}</small>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
      <section className="stack">
        <h2>留下的信物</h2>
        {keepsakes.length ? (
          <>
            <button type="button" className="btn primary" onClick={() => setOpen(keepsakes[0])}>看看這顆信物</button>
            <div className="stack">
              {keepsakes.map((deed) => {
                const line = warmLine({ name: deed.character?.name ?? "一位鎮民", title: deed.title, districtKey: deed.districtKey });
                return (
                  <button key={deed.id} type="button" className="panel row card-link" onClick={() => setOpen(deed)}>
                    <span className="keepsake-emoji" aria-hidden>{keepsakeFor(deed.districtKey).emoji}</span>
                    <span className="grow" style={{ textAlign: "left" }}>
                      <strong>{line}</strong>
                      <small style={{ display: "block" }}>{timeAgo(deed.createdAt)}</small>
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <div className="empty stack">
            <p>這裡還沒有信物。小龍說牠想去別的地方聞聞。</p>
            <Link to="/map" className="btn primary">換個地方看看</Link>
          </div>
        )}
      </section>
      {open && (
        <Dialog title={keepsakeFor(open.districtKey).name} busy={busy} onClose={() => { if (!busy) setOpen(null); }}>
          <p className="keepsake-emoji" aria-hidden>{keepsakeFor(open.districtKey).emoji}</p>
          <p>{warmLine({ name: open.character?.name ?? "一位鎮民", title: open.title, districtKey: open.districtKey })}</p>
          <button type="button" className="btn primary" disabled={busy} onClick={() => void accept(open)}>{busy ? "記下來…" : "我也去摸摸看"}</button>
        </Dialog>
      )}
    </div>
  );
}
