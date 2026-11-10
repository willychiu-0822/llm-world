import { dedupeKeepsakes, keepsakeFor, townFolk, warmLine } from "@lj/core";
import { Link, useParams } from "react-router-dom";
import { ErrorBox, Loading } from "../components/Bits";
import { timeAgo } from "../lib/format";
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
  const { data, error, loading } = useFetch<PlaceView>(`/api/places/${id}`);
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  if (!data) return null;
  const folk = townFolk(data.districtKey);
  const keepsakes = uniqueKeepsakes(data.deeds);
  return (
    <div className="stack">
      <section className="panel hero stack" style={{ gap: 6 }}>
        <h1>{data.name}</h1>
        {data.kind === "shop" && data.providerName && <p>{data.providerName}的小店</p>}
        <p><strong>{folk.name}</strong>：「{folk.line}」</p>
        {data.description && <p className="muted">{data.description}</p>}
        {data.kind === "shop" && <p>{data.online ? "線上見" : data.realAddress ? `📍 ${data.realAddress}` : ""}</p>}
      </section>
      {data.trials.length > 0 && (
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
      {keepsakes.length > 0 && <Link to="/" className="btn primary">回小龍身邊</Link>}
      <section className="stack">
        <h2>留下的信物</h2>
        {keepsakes.length ? (
          <div className="stack">
            {keepsakes.map((deed) => {
              const line = warmLine({ name: deed.character?.name ?? "一位鎮民", title: deed.title, districtKey: deed.districtKey });
              return (
                <Link key={deed.id} to={`/deeds/${deed.id}`} className="card-link">
                  <div className="panel row">
                    <span className="keepsake-emoji" aria-hidden>{keepsakeFor(deed.districtKey).emoji}</span>
                    <div className="grow">
                      <strong>{line}</strong>
                      <small style={{ display: "block" }}>{timeAgo(deed.createdAt)}</small>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="empty stack">
            <p>這裡還沒有信物。小龍說牠想去別的地方聞聞。</p>
            <Link to="/" className="btn primary">回小龍身邊</Link>
          </div>
        )}
      </section>
    </div>
  );
}
