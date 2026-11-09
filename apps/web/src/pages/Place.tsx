import { useParams } from "react-router-dom";
import { DeedCard, DistrictTag, Empty, ErrorBox, Loading, TrialCard } from "../components/Bits";
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

export function PlacePage() {
  const { id } = useParams();
  const { data, error, loading } = useFetch<PlaceView>(`/api/places/${id}`);
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  if (!data) return null;
  return (
    <div className="stack">
      <section className="panel hero stack" style={{ gap: 6 }}>
        <div className="row wrap" style={{ gap: 6 }}>
          <DistrictTag k={data.districtKey} />
          {data.kind === "shop" && <span className="tag tag-first">提供者的店</span>}
          {data.isDemo && <span className="tag tag-demo">示範</span>}
        </div>
        <h1>{data.name}</h1>
        {data.providerName && <p>由「{data.providerName}」經營</p>}
        {data.description && <p className="muted">{data.description}</p>}
        {data.kind === "shop" && <p>{data.online ? "📍 線上活動" : data.realAddress ? `📍 實際地點：${data.realAddress}` : ""}</p>}
      </section>
      {data.trials.length > 0 && (
        <section className="stack">
          <h2>試用機會</h2>
          <div className="grid">{data.trials.map((t) => <TrialCard key={t.id} trial={t} />)}</div>
        </section>
      )}
      <section className="stack">
        <h2>在這裡發生的事蹟</h2>
        {data.deeds.length ? <div className="grid">{data.deeds.map((d) => <DeedCard key={d.id} deed={d} />)}</div> : <Empty>這裡還沒有事蹟。也許你會是第一個？</Empty>}
      </section>
    </div>
  );
}
