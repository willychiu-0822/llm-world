import { useState } from "react";
import { Empty, ErrorBox, Loading } from "../components/Bits";
import { api } from "../lib/api";
import { formatDateTime } from "../lib/format";
import { useSession } from "../lib/session";
import { useFetch } from "../lib/useFetch";

interface Provider { id: string; name: string; description: string; status: string; email: string; isDemo: boolean; createdAt: string }
interface Mod { id: string; targetType: string; excerpt: string; categories: string[]; action: string; createdAt: string }
interface Metrics {
  users: number;
  characters: number;
  steps: { total: number; draft: number; confirmed: number; done: number; dropped: number; byExecutor: { ai: number; self: number } };
  deeds: { total: number; real: number; demo: number; followed: number };
  notes: { before: number; after: number; shared: number };
}

export function AdminPage() {
  const { me, toast } = useSession();
  const providers = useFetch<Provider[]>("/api/admin/providers");
  const mods = useFetch<Mod[]>("/api/admin/moderation");
  const metrics = useFetch<Metrics>("/api/admin/metrics");
  const [deedId, setDeedId] = useState("");
  const [error, setError] = useState<Error | null>(null);
  if (!me?.user.roles.includes("admin")) return <Empty>需要管理者權限。</Empty>;
  const act = async (fn: () => Promise<unknown>, msg: string) => {
    try {
      await fn();
      toast(msg);
      setError(null);
      await Promise.all([providers.reload(), metrics.reload()]);
    } catch (e) {
      setError(e as Error);
    }
  };
  const m = metrics.data;
  return (
    <div className="stack">
      <h1>管理</h1>
      <ErrorBox error={error} />
      <section className="panel stack">
        <h2>主閉環健康指標</h2>
        {!m ? <Loading /> : (
          <div className="grid">
            <div><div className="stat">{m.users}</div><small>真人用戶（{m.characters} 個角色）</small></div>
            <div><div className="stat">{m.steps.total}</div><small>第一步：草稿 {m.steps.draft}、進行中 {m.steps.confirmed}、完成 {m.steps.done}、放下 {m.steps.dropped}</small></div>
            <div><div className="stat">{m.steps.byExecutor.ai} / {m.steps.byExecutor.self}</div><small>AI 執行 / 本人執行</small></div>
            <div><div className="stat">{m.deeds.real}</div><small>真人事蹟（示範 {m.deeds.demo}、被參考過 {m.deeds.followed}）</small></div>
            <div><div className="stat">{m.notes.shared}</div><small>分享的隨筆（做前 {m.notes.before}、做後 {m.notes.after}）</small></div>
          </div>
        )}
      </section>
      <section className="panel stack">
        <h2>提供者</h2>
        {!providers.data ? <Loading /> : !providers.data.length ? <Empty>還沒有提供者。</Empty> : (
          <table>
            <thead><tr><th>名稱</th><th>Email</th><th>狀態</th><th /></tr></thead>
            <tbody>
              {providers.data.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}{p.isDemo && <span className="tag tag-demo">示範</span>}<br /><small>{p.description}</small></td>
                  <td>{p.email}</td>
                  <td>{p.status}</td>
                  <td className="row wrap">
                    {p.status !== "approved" && <button className="btn small" onClick={() => act(() => api(`/api/admin/providers/${p.id}/approve`, { method: "POST" }), `已核准 ${p.name}`)}>核准</button>}
                    {p.status !== "suspended" && <button className="btn small danger" onClick={() => act(() => api(`/api/admin/providers/${p.id}/suspend`, { method: "POST" }), `已停權 ${p.name}`)}>停權</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <section className="panel stack">
        <h2>內容過濾紀錄</h2>
        {!mods.data ? <Loading /> : !mods.data.length ? <Empty>沒有紀錄。</Empty> : (
          <table>
            <thead><tr><th>時間</th><th>類型</th><th>內容</th><th>處理</th></tr></thead>
            <tbody>{mods.data.map((x) => <tr key={x.id}><td>{formatDateTime(x.createdAt)}</td><td>{x.targetType}</td><td>{x.excerpt}</td><td>{x.action}（{x.categories.join("、")}）</td></tr>)}</tbody>
          </table>
        )}
        <form className="row wrap" onSubmit={(e) => { e.preventDefault(); void act(() => api(`/api/admin/deeds/${deedId.trim()}/remove`, { method: "POST" }), "已下架事蹟"); }}>
          <input aria-label="事蹟 ID" placeholder="要下架的事蹟 ID（deed_…）" value={deedId} onChange={(e) => setDeedId(e.target.value)} style={{ flex: 1, minWidth: 220 }} />
          <button className="btn small danger" type="submit">下架事蹟</button>
        </form>
      </section>
      <section className="panel stack">
        <h2>示範內容</h2>
        <p className="muted">示範內容都標示「示範」，排在真人內容之後，也不會觸發回謝。等鎮上有足夠的真人事蹟，就可以清除。</p>
        <button className="btn danger" onClick={() => window.confirm("確定要清除所有示範內容嗎？") && act(() => api("/api/admin/demo/purge", { method: "POST" }), "已清除示範內容")}>清除所有示範內容</button>
      </section>
    </div>
  );
}
