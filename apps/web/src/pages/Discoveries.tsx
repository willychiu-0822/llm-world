import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Avatar } from "../components/Avatar";
import { Empty, ErrorBox, ExecutorTag, Loading } from "../components/Bits";
import { GrownGate } from "../components/GrownGate";
import { api } from "../lib/api";
import { timeAgo } from "../lib/format";
import { useSession } from "../lib/session";
import { useFetch } from "../lib/useFetch";

interface Discovery {
  id: string;
  message: string;
  readAt: string | null;
  createdAt: string;
  items: { type: "deed" | "trial" | "place"; id: string; title: string; districtKey: string; isDemo: boolean; executor?: string; characterName?: string | null }[];
}

const LINK = { deed: "deeds", trial: "trials", place: "places" } as const;

export function DiscoveriesPage() {
  return <GrownGate><DiscoveriesBody /></GrownGate>;
}

function DiscoveriesBody() {
  const { me, reload: reloadMe } = useSession();
  const { data, error, loading } = useFetch<Discovery[]>("/api/discoveries");
  useEffect(() => {
    const unread = data?.filter((d) => !d.readAt) ?? [];
    if (!unread.length) return;
    void Promise.all(unread.map((d) => api(`/api/discoveries/${d.id}/read`, { method: "POST" }))).then(() => reloadMe());
  }, [data]);
  if (loading && !data) return <Loading />;
  return (
    <div className="stack" style={{ maxWidth: 760, margin: "0 auto" }}>
      <h1>發現匣</h1>
      <ErrorBox error={error} />
      {!data?.length && (
        <Empty>
          <p>還沒有發現。請朋友去鎮上逛逛，或到地圖上看看大家做過的事。</p>
          <Link to="/connect" className="btn ghost">請朋友去逛逛</Link>
          <Link to="/map" className="btn primary">去地圖看看</Link>
        </Empty>
      )}
      {data?.map((d) => (
        <article key={d.id} className="who">
          <Avatar appearance={me?.character?.appearance} name={me?.character?.name ?? "我的角色"} size={52} />
          <div className="bubble grow stack" style={{ gap: 8 }}>
            <div className="row">
              <strong className="grow">{me?.character?.name ?? "我的角色"}</strong>
              {!d.readAt && <span className="badge">新</span>}
              <small>{timeAgo(d.createdAt)}</small>
            </div>
            <p style={{ whiteSpace: "pre-wrap" }}>{d.message}</p>
            <ul className="plain">
              {d.items.map((i) => (
                <li key={`${i.type}-${i.id}`}>
                  <Link to={`/${LINK[i.type]}/${i.id}`} className="card-link">
                    <div className="panel soft row wrap" style={{ padding: 10 }}>
                      {i.type === "deed" ? <ExecutorTag executor={i.executor ?? "self"} /> : <span className="tag tag-first">{i.type === "trial" ? "試用機會" : "地點"}</span>}
                      {i.isDemo && <span className="tag tag-demo">示範</span>}
                      <span className="grow">「{i.title}」{i.characterName && <small> — {i.characterName}</small>}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </article>
      ))}
    </div>
  );
}
