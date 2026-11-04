import { Link, useParams } from "react-router-dom";
import { Avatar } from "../components/Avatar";
import { DistrictTag, ErrorBox, ExecutorTag, Loading, RealTag } from "../components/Bits";
import { api } from "../lib/api";
import { formatDate } from "../lib/format";
import { useSession } from "../lib/session";
import type { DeedView } from "../lib/types";
import { useFetch } from "../lib/useFetch";

const SOURCE: Record<string, string> = { provider_confirmed: "提供者確認出席", self: "本人紀錄", ai: "AI 角色回報" };

export function DeedPage() {
  const { id } = useParams();
  const { me, toast } = useSession();
  const { data, error, loading, reload } = useFetch<DeedView>(`/api/deeds/${id}`);
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  if (!data) return null;
  const toggle = async () => {
    await api(`/api/deeds/${data.id}`, { method: "PATCH", body: { visibility: data.visibility === "public" ? "private" : "public" } });
    toast(data.visibility === "public" ? "已改成私人" : "已公開到鎮上");
    await reload();
  };
  return (
    <div className="stack" style={{ maxWidth: 760, margin: "0 auto" }}>
      <article className="panel stack">
        <div className="row">
          <Avatar appearance={data.character?.appearance} name={data.character?.name ?? "鎮民"} size={72} />
          <div className="grow">
            <h2 style={{ margin: 0 }}>{data.character?.name ?? "某位鎮民"}</h2>
            <div className="row wrap" style={{ gap: 6 }}>
              <RealTag demo={data.isDemo} />
              <ExecutorTag executor={data.executor} />
              {data.isFirst && <span className="tag tag-first">第一次</span>}
              <DistrictTag k={data.districtKey} />
            </div>
          </div>
        </div>
        {data.isDemo && <p className="notice">這是示範內容，不是真人的經驗。</p>}
        <div>
          <small>第一步</small>
          <h1>「{data.title}」</h1>
        </div>
        {data.summary && (
          <div className="bubble">
            <small>{data.executor === "ai" ? "AI 角色帶回的結果" : "紀錄"}</small>
            <p style={{ whiteSpace: "pre-wrap" }}>{data.summary}</p>
          </div>
        )}
        {(data.sharedNotes.before || data.sharedNotes.after) && (
          <div className="notes-pair">
            <div className="before"><small>做之前</small><p>{data.sharedNotes.before ?? "（沒有分享）"}</p></div>
            <div className="after"><small>做之後</small><p>{data.sharedNotes.after ?? "（沒有分享）"}</p></div>
          </div>
        )}
        <small>
          {formatDate(data.createdAt)}・{SOURCE[data.recordSource] ?? data.recordSource}
          {data.place && <>・<Link to={`/places/${data.place.id}`}>{data.place.name}</Link></>}
          {data.trial && <>・<Link to={`/trials/${data.trial.id}`}>{data.trial.title}</Link></>}
        </small>
        {data.related.length > 0 && (
          <p className="muted">
            這一步參考了：{data.related.map((r, i) => <span key={r.id}>{i > 0 && "、"}<Link to={`/deeds/${r.id}`}>「{r.title}」</Link></span>)}
          </p>
        )}
        {data.isMine ? (
          <div className="panel soft stack" style={{ gap: 8 }}>
            <strong>這是你的事蹟</strong>
            {data.followers && (
              <p>
                {data.followers.referenced > 0
                  ? `有 ${data.followers.referenced} 個人參考了你的第一步，其中 ${data.followers.completed} 個人也做到了。`
                  : "還沒有人參考這一步。它已經在鎮上，等著被需要的人看見。"}
                <small>（只有你看得到）</small>
              </p>
            )}
            <div className="row wrap">
              <span>目前：{data.visibility === "public" ? "公開" : "私人"}</span>
              <button className="btn small" onClick={toggle}>{data.visibility === "public" ? "改成私人" : "公開到鎮上"}</button>
            </div>
          </div>
        ) : (
          <div className="row wrap">
            <Link className="btn primary" to={me ? `/steps/new?deedId=${data.id}` : `/login?next=${encodeURIComponent(`/steps/new?deedId=${data.id}`)}`}>
              我也想做
            </Link>
            <small className="muted">定義一個你自己的小小第一步</small>
          </div>
        )}
      </article>
    </div>
  );
}
