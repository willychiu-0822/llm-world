import { DISTRICT_BY_KEY, type DistrictKey } from "@lj/core";
import { Link } from "react-router-dom";
import { Avatar } from "../components/Avatar";
import { DistrictTag, Empty, ErrorBox, ExecutorTag, Loading } from "../components/Bits";
import { GrownGate } from "../components/GrownGate";
import { formatDate } from "../lib/format";
import { useSession } from "../lib/session";
import { useFetch } from "../lib/useFetch";

interface Mirror {
  footprints: { placeId: string; placeName: string; districtKey: string; firstAt: string; count: number }[];
  overlap: { want: { id: string; text: string; districtKey: string }; deeds: { id: string; title: string; executor: string }[] }[];
  notePairs: { stepId: string; text: string; before: string | null; after: string | null; doneAt: string }[];
  stats: { deeds: number; byExecutor: { ai: number; self: number }; followed: { referenced: number; completed: number } };
}

export function MirrorPage() {
  return <GrownGate><MirrorBody /></GrownGate>;
}

function MirrorBody() {
  const { me } = useSession();
  const { data, error, loading } = useFetch<Mirror>("/api/mirror");
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  if (!data) return null;
  return (
    <div className="stack" style={{ maxWidth: 860, margin: "0 auto" }}>
      <section className="panel hero row wrap">
        <Avatar appearance={me?.character?.appearance} name={me?.character?.name ?? "我"} size={80} />
        <div className="grow">
          <h1>足跡</h1>
          <p>這裡記的是你真的做過的事。</p>
          <p>
            你做了 <strong>{data.stats.deeds}</strong> 件（自己 {data.stats.byExecutor.self}、朋友幫忙 {data.stats.byExecutor.ai}）。
            {data.stats.followed.referenced > 0 && <> 有 <strong>{data.stats.followed.referenced}</strong> 個人參考了你的經驗，其中 {data.stats.followed.completed} 個人也做到了。<small>（只有你看得到）</small></>}
          </p>
        </div>
      </section>

      <section className="panel stack">
        <h2>角色和你的重疊</h2>
        {data.overlap.length === 0 ? <Empty><p>還沒有想做的事。</p><Link to="/me/character" className="btn ghost">去寫一件</Link></Empty> : (
          <ul className="plain">
            {data.overlap.map((o) => (
              <li key={o.want.id} className="panel soft stack" style={{ gap: 6 }}>
                <div className="row wrap"><DistrictTag k={o.want.districtKey} /><strong className="grow">{o.want.text}</strong><small>{o.deeds.length ? `已經有 ${o.deeds.length} 步成真` : "還在想像中"}</small></div>
                {o.deeds.length > 0 && <div className="chips">{o.deeds.map((d) => <Link key={d.id} to={`/deeds/${d.id}`} className="chip"><ExecutorTag executor={d.executor} /> {d.title}</Link>)}</div>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel stack">
        <h2>足跡</h2>
        {data.footprints.length === 0 ? <Empty><p>還沒有足跡。完成一件小事，就會留在這裡。</p><Link to="/steps" className="btn ghost">去我的步驟</Link></Empty> : (
          <div className="chips">
            {data.footprints.map((f) => (
              <Link key={f.placeId} to={`/places/${f.placeId}`} className="chip" style={{ background: DISTRICT_BY_KEY[f.districtKey as DistrictKey]?.color }}>
                {f.placeName}・{formatDate(f.firstAt)} 起・{f.count} 次
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="panel stack">
        <h2>做之前／做之後</h2>
        {data.notePairs.length === 0 ? <Empty><p>寫下做之前和做之後的話，就會出現在這裡。不寫也沒關係。</p><Link to="/steps" className="btn ghost">到我的步驟寫一點</Link></Empty> : (
          <ul className="plain">
            {data.notePairs.map((p) => (
              <li key={p.stepId} className="stack" style={{ gap: 6 }}>
                <strong>「{p.text}」<small> {formatDate(p.doneAt)}</small></strong>
                <div className="notes-pair">
                  <div className="before"><small>做之前</small><p>{p.before ?? "（沒寫）"}</p></div>
                  <div className="after"><small>做之後</small><p>{p.after ?? "（沒寫）"}</p></div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
