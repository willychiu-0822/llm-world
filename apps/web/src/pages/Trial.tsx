import { Link, useParams } from "react-router-dom";
import { DistrictTag, ErrorBox, Loading } from "../components/Bits";
import { GrownGate } from "../components/GrownGate";
import { formatDateTime } from "../lib/format";
import { useSession } from "../lib/session";
import type { TrialView } from "../lib/types";
import { useFetch } from "../lib/useFetch";

export function TrialPage() {
  return <GrownGate><TrialBody /></GrownGate>;
}

function TrialBody() {
  const { id } = useParams();
  const { me } = useSession();
  const { data, error, loading } = useFetch<TrialView>(`/api/trials/${id}`);
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  if (!data) return null;
  const next = `/steps/new?trialId=${data.id}`;
  return (
    <div className="stack" style={{ maxWidth: 760, margin: "0 auto" }}>
      <article className="panel stack">
        <div className="row wrap" style={{ gap: 6 }}>
          <span className="tag tag-first">試用機會</span>
          <DistrictTag k={data.place.districtKey} />
          {data.isDemo && <span className="tag tag-demo">示範</span>}
        </div>
        <h1>{data.title}</h1>
        <p>由「{data.provider.name}」提供・<Link to={`/places/${data.place.id}`}>{data.place.name}</Link></p>
        <div className="chips">
          <span className="chip">⏱ {data.durationMin} 分鐘</span>
          <span className="chip">{data.exitAnytime ? "🚪 隨時可以離開" : "需要完整參加"}</span>
          {data.buddyOk && <span className="chip">👫 可以帶朋友</span>}
          {data.whenText && <span className="chip">🗓 {data.whenText}</span>}
          <span className="chip">📍 {data.place.online ? "線上" : (data.place.realAddress ?? "地點洽提供者")}</span>
        </div>
        {data.description && <p>{data.description}</p>}
        {data.processInfo && (
          <div className="bubble">
            <small>會發生什麼</small>
            <p style={{ whiteSpace: "pre-wrap" }}>{data.processInfo}</p>
          </div>
        )}
        {data.faqs.length > 0 && (
          <section>
            <h2>常見問題</h2>
            <dl>
              {data.faqs.map((f) => (
                <div key={f.id} style={{ marginBottom: 10 }}>
                  <dt style={{ fontWeight: 700 }}>Q：{f.question}</dt>
                  <dd style={{ margin: 0 }}>A：{f.answer}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}
        <section>
          <h2>接下來的場次</h2>
          {data.sessions.length ? (
            <ul className="plain">
              {data.sessions.map((s) => (
                <li key={s.id} className="row">
                  <span className="grow">{formatDateTime(s.startsAt)}</span>
                  <small>{s.remaining > 0 ? `剩 ${s.remaining} 位` : "已額滿"}</small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">目前沒有排定的場次，可以先請 AI 角色去問問看。</p>
          )}
        </section>
        <div className="row wrap">
          <Link className="btn primary" to={me ? next : `/login?next=${encodeURIComponent(next)}`}>我也想試試</Link>
          <small className="muted">可以交給 AI 先打聽，也可以直接報名</small>
        </div>
      </article>
    </div>
  );
}
