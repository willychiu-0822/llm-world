import { DISTRICTS, PALETTE } from "@lj/core";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { DistrictTag, Empty, ErrorBox, Loading } from "../components/Bits";
import { api } from "../lib/api";
import { formatDateTime } from "../lib/format";
import { useSession } from "../lib/session";
import type { Session, Trial } from "../lib/types";
import { useFetch } from "../lib/useFetch";

interface Shop {
  id: string;
  districtKey: string;
  name: string;
  description: string;
  roofColor: string;
  realAddress: string | null;
  online: boolean;
}
interface Dashboard {
  provider: { id: string; name: string; description: string; status: string } | null;
  shops: Shop[];
  trials: (Trial & { faqs: { id: string; question: string; answer: string }[]; sessions: Session[] })[];
  unansweredQuestions: number;
}
interface Question {
  id: string;
  trialId: string;
  trialTitle: string;
  question: string;
  answer: string | null;
  createdAt: string;
}
interface Signal {
  trialId: string;
  title: string;
  aiViews: number;
  questions: number;
  bookings: number;
  attended: number;
  deeds: number;
  follows: number;
  recentQuestions: string[];
  sharedNotes: { before: string | null; after: string | null }[];
}

function useAction() {
  const { toast } = useSession();
  const [error, setError] = useState("");
  const run = async (fn: () => Promise<unknown>, ok: string, after?: () => unknown) => {
    try {
      await fn();
      setError("");
      toast(ok);
      await after?.();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return { error, run };
}

function Apply({ onDone }: { onDone(): void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const { error, run } = useAction();
  return (
    <form className="panel stack" onSubmit={(e) => { e.preventDefault(); void run(() => api("/api/provider/apply", { method: "POST", body: { name, description } }), "已送出申請", onDone); }}>
      <h1>成為提供者</h1>
      <p>如果你帶跑步、教唱歌、辦讀書會……可以在龍角鎮開一間店，提供「試一次」的機會。申請後由管理者核准。</p>
      <p className="muted">在這裡不能買曝光：你的活動被看見的唯一方式，是把別人的第一次辦好。</p>
      <label className="field"><span>名稱</span><input aria-label="提供者名稱" value={name} onChange={(e) => setName(e.target.value)} required maxLength={40} /></label>
      <label className="field"><span>介紹</span><textarea aria-label="提供者介紹" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={500} /></label>
      {error && <p role="alert" className="error">{error}</p>}
      <button className="btn primary" type="submit">送出申請</button>
    </form>
  );
}

function ShopForm({ onDone, primary }: { onDone(): void; primary: boolean }) {
  const [f, setF] = useState({ districtKey: "music", name: "", description: "", roofColor: PALETTE[1] as string, realAddress: "", online: false });
  const { error, run } = useAction();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void run(() => api("/api/provider/shops", { method: "POST", body: { ...f, realAddress: f.realAddress || undefined } }), "店開好了", onDone);
  };
  return (
    <form className="panel soft stack" onSubmit={submit} aria-label="開一間店">
      <h3>在鎮上開一間店</h3>
      <div className="row wrap">
        <label className="field grow"><span>主題區</span>
          <select aria-label="店的主題區" value={f.districtKey} onChange={(e) => setF({ ...f, districtKey: e.target.value })}>{DISTRICTS.map((d) => <option key={d.key} value={d.key}>{d.name}</option>)}</select>
        </label>
        <label className="field grow"><span>店名</span><input aria-label="店名" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required maxLength={30} /></label>
      </div>
      <label className="field"><span>介紹</span><input aria-label="店的介紹" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} maxLength={300} /></label>
      <div className="field"><span>屋頂顏色</span><div className="swatches">{PALETTE.map((c) => <button type="button" key={c} className="swatch" style={{ background: c }} aria-label={`屋頂顏色 ${c}`} aria-pressed={f.roofColor === c} onClick={() => setF({ ...f, roofColor: c })} />)}</div></div>
      <label className="check"><input type="checkbox" checked={f.online} onChange={(e) => setF({ ...f, online: e.target.checked })} />線上活動（沒有實體地點）</label>
      {!f.online && <label className="field"><span>實際地址（參加者要去的地方）</span><input aria-label="實際地址" value={f.realAddress} onChange={(e) => setF({ ...f, realAddress: e.target.value })} maxLength={200} /></label>}
      {error && <p role="alert" className="error">{error}</p>}
      <button className={`btn ${primary ? "primary" : "ghost"}`} type="submit">開店</button>
    </form>
  );
}

function TrialForm({ shops, onDone, primary }: { shops: Shop[]; onDone(): void; primary: boolean }) {
  const [f, setF] = useState({ placeId: shops[0]?.id ?? "", title: "", description: "", durationMin: 60, exitAnytime: true, buddyOk: true, whenText: "", processInfo: "", aiFirstStepHint: "", selfFirstStepHint: "" });
  const { error, run } = useAction();
  const t = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return (
    <form className="panel soft stack" aria-label="新增試用機會" onSubmit={(e) => { e.preventDefault(); void run(() => api("/api/provider/trials", { method: "POST", body: f }), "試用機會上架了", onDone); }}>
      <h3>新增試用機會</h3>
      <p className="muted">好的第一步：只要一次、時間短、具體、可以隨時離開、可以帶人。</p>
      <div className="row wrap">
        <label className="field grow"><span>在哪間店</span><select aria-label="在哪間店" value={f.placeId} onChange={t("placeId")}>{shops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label className="field grow"><span>名稱</span><input aria-label="試用機會名稱" value={f.title} onChange={t("title")} required maxLength={60} /></label>
      </div>
      <div className="row wrap">
        <label className="field grow"><span>時長（分鐘）</span><input aria-label="時長（分鐘）" type="number" min={10} max={480} value={f.durationMin} onChange={(e) => setF({ ...f, durationMin: Number(e.target.value) })} /></label>
        <label className="field grow"><span>時間說明</span><input aria-label="時間說明" value={f.whenText} onChange={t("whenText")} placeholder="例如：每週日 07:00" maxLength={100} /></label>
      </div>
      <div className="row wrap">
        <label className="check"><input type="checkbox" checked={f.exitAnytime} onChange={(e) => setF({ ...f, exitAnytime: e.target.checked })} />可以隨時離開</label>
        <label className="check"><input type="checkbox" checked={f.buddyOk} onChange={(e) => setF({ ...f, buddyOk: e.target.checked })} />可以帶朋友／配對同行</label>
      </div>
      <label className="field"><span>介紹</span><textarea aria-label="試用機會介紹" value={f.description} onChange={t("description")} rows={2} maxLength={1000} /></label>
      <label className="field"><span>過程資訊（前十分鐘會發生什麼、第一次的人多不多）</span><textarea aria-label="過程資訊" value={f.processInfo} onChange={t("processInfo")} rows={3} maxLength={2000} /></label>
      <div className="row wrap">
        <label className="field grow"><span>建議的 AI 第一步</span><input aria-label="建議的 AI 第一步" value={f.aiFirstStepHint} onChange={t("aiFirstStepHint")} placeholder="來問我的 agent 任何問題" maxLength={200} /></label>
        <label className="field grow"><span>建議的本人第一步</span><input aria-label="建議的本人第一步" value={f.selfFirstStepHint} onChange={t("selfFirstStepHint")} placeholder="報名這週的場次" maxLength={200} /></label>
      </div>
      {error && <p role="alert" className="error">{error}</p>}
      <button className={`btn ${primary ? "primary" : "ghost"}`} type="submit">上架</button>
    </form>
  );
}

function Bookings({ sessionId }: { sessionId: string }) {
  const { data, reload } = useFetch<{ id: string; characterName: string; attendedAt: string | null }[]>(`/api/provider/sessions/${sessionId}/bookings`);
  const { error, run } = useAction();
  if (!data) return <Loading />;
  if (!data.length) return <p className="muted">還沒有人報名。</p>;
  return (
    <ul className="plain">
      {data.map((b) => (
        <li key={b.id} className="row">
          <span className="grow">{b.characterName}</span>
          {b.attendedAt ? <span className="tag tag-self">已出席</span> : <button className="btn small" onClick={() => run(() => api(`/api/provider/bookings/${b.id}/attend`, { method: "POST" }), `已確認 ${b.characterName} 出席`, reload)}>確認出席</button>}
        </li>
      ))}
      {error && <p role="alert" className="error">{error}</p>}
    </ul>
  );
}

function TrialBox({ trial, reload }: { trial: Dashboard["trials"][number]; reload(): void }) {
  const [q, setQ] = useState("");
  const [a, setA] = useState("");
  const [when, setWhen] = useState("");
  const [cap, setCap] = useState(10);
  const [open, setOpen] = useState<string | null>(null);
  const { error, run } = useAction();
  return (
    <article className="panel stack">
      <div className="row wrap">
        <h3 className="grow" style={{ margin: 0 }}>{trial.title}</h3>
        <span className="tag">{trial.status === "active" ? "上架中" : "已下架"}</span>
        <button className="btn small ghost" onClick={() => run(() => api(`/api/provider/trials/${trial.id}`, { method: "PATCH", body: { status: trial.status === "active" ? "archived" : "active" } }), "已更新", reload)}>{trial.status === "active" ? "下架" : "重新上架"}</button>
      </div>
      <small>{trial.durationMin} 分鐘・{trial.whenText}</small>
      <section>
        <strong>常見問答</strong>
        <ul className="plain">
          {trial.faqs.map((f) => (
            <li key={f.id} className="row"><span className="grow">Q：{f.question}<br />A：{f.answer}</span><button className="btn small ghost" onClick={() => run(() => api(`/api/provider/faqs/${f.id}`, { method: "DELETE" }), "已刪除", reload)}>刪除</button></li>
          ))}
        </ul>
        <form className="row wrap" onSubmit={(e) => { e.preventDefault(); void run(() => api(`/api/provider/trials/${trial.id}/faqs`, { method: "POST", body: { question: q, answer: a } }), "已新增問答", () => { setQ(""); setA(""); reload(); }); }}>
          <input aria-label="問題" placeholder="問題" value={q} onChange={(e) => setQ(e.target.value)} required style={{ flex: 1, minWidth: 160 }} />
          <input aria-label="回答" placeholder="回答" value={a} onChange={(e) => setA(e.target.value)} required style={{ flex: 2, minWidth: 200 }} />
          <button className="btn small" type="submit">新增問答</button>
        </form>
      </section>
      <section>
        <strong>場次</strong>
        <ul className="plain">
          {trial.sessions.map((s) => (
            <li key={s.id} className="stack" style={{ gap: 4 }}>
              <div className="row"><span className="grow">{formatDateTime(s.startsAt)}（{s.capacity - s.remaining}/{s.capacity} 人）</span><button className="btn small ghost" onClick={() => setOpen(open === s.id ? null : s.id)}>{open === s.id ? "收起" : "報名名單"}</button></div>
              {open === s.id && <div className="panel soft"><Bookings sessionId={s.id} /></div>}
            </li>
          ))}
        </ul>
        <form className="row wrap" onSubmit={(e) => { e.preventDefault(); void run(() => api(`/api/provider/trials/${trial.id}/sessions`, { method: "POST", body: { startsAt: `${when}:00+08:00`, capacity: cap } }), "已新增場次", reload); }}>
          <input aria-label="場次時間" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} required style={{ flex: 2, minWidth: 200 }} />
          <input aria-label="名額" type="number" min={1} max={500} value={cap} onChange={(e) => setCap(Number(e.target.value))} style={{ width: 100 }} />
          <button className="btn small" type="submit">新增場次</button>
        </form>
      </section>
      {error && <p role="alert" className="error">{error}</p>}
    </article>
  );
}

function Questions({ reloadDash }: { reloadDash(): void }) {
  const { data, reload } = useFetch<Question[]>("/api/provider/questions");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [toFaq, setToFaq] = useState<Record<string, boolean>>({});
  const { error, run } = useAction();
  const pending = data?.filter((q) => !q.answer) ?? [];
  return (
    <section className="panel stack">
      <h2>大家的 AI 問的問題</h2>
      {!pending.length ? <Empty>目前沒有待回答的問題。可以先到<a href="#provider-trials">試用機會</a>，把第一次參加會做什麼寫清楚。</Empty> : (
        <ul className="plain">
          {pending.map((q) => (
            <li key={q.id} className="panel soft stack" style={{ gap: 6 }}>
              <small>{q.trialTitle}・{formatDateTime(q.createdAt)}</small>
              <strong>{q.question}</strong>
              <textarea aria-label={`回答：${q.question}`} rows={2} value={answers[q.id] ?? ""} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} />
              <label className="check"><input type="checkbox" checked={toFaq[q.id] ?? true} onChange={(e) => setToFaq({ ...toFaq, [q.id]: e.target.checked })} />同時加入常見問答</label>
              <button className="btn small" onClick={() => run(() => api(`/api/provider/questions/${q.id}/answer`, { method: "POST", body: { answer: answers[q.id] ?? "", addToFaq: toFaq[q.id] ?? true } }), "已回答", () => { reload(); reloadDash(); })}>回答</button>
            </li>
          ))}
        </ul>
      )}
      {error && <p role="alert" className="error">{error}</p>}
    </section>
  );
}

function Signals() {
  const { data } = useFetch<Signal[]>("/api/provider/signals");
  if (!data) return <Loading />;
  return (
    <section className="panel stack">
      <h2>需求訊號與回謝</h2>
      <p className="muted">全部匿名。這些是大家真實的好奇和擔心。</p>
      {!data.length && <Empty>還沒有需求訊號。先<a href="#provider-trials">上架試用機會</a>，讓鎮民找到你的店。</Empty>}
      {data.map((s) => (
        <article key={s.trialId} className="panel soft stack" style={{ gap: 6 }}>
          <strong>{s.title}</strong>
          <div className="chips">
            <span className="chip">AI 來看過 {s.aiViews} 次</span>
            <span className="chip">被問了 {s.questions} 個問題</span>
            <span className="chip">報名 {s.bookings}</span>
            <span className="chip">出席 {s.attended}</span>
            <span className="chip">被參考 {s.follows} 次</span>
          </div>
          {s.recentQuestions.length > 0 && <p><small>最近的問題：</small>{s.recentQuestions.slice(0, 5).map((q) => `「${q}」`).join("、")}</p>}
          {s.sharedNotes.length > 0 && (
            <div className="stack" style={{ gap: 6 }}>
              <small>參加者選擇分享的隨筆（可以放進下一場的過程資訊）</small>
              {s.sharedNotes.map((n, i) => <div key={i} className="notes-pair"><div className="before"><small>做之前</small><p>{n.before ?? "—"}</p></div><div className="after"><small>做之後</small><p>{n.after ?? "—"}</p></div></div>)}
            </div>
          )}
        </article>
      ))}
    </section>
  );
}

export function ProviderPage() {
  const { reload: reloadMe } = useSession();
  const { data, error, loading, reload } = useFetch<Dashboard>("/api/provider/me");
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  if (!data) return null;
  const after = async () => {
    await reload();
    await reloadMe();
  };
  if (!data.provider) return <div style={{ maxWidth: 680, margin: "0 auto" }}><Apply onDone={after} /></div>;
  if (data.provider.status !== "approved")
    return (
      <section className="panel stack" style={{ maxWidth: 680, margin: "0 auto" }}>
        <h1>{data.provider.name}</h1>
        <p>{data.provider.status === "pending" ? "申請審核中，核准後會通知你。" : "這個提供者帳號目前已停權，如有疑問請聯絡管理者。"}</p>
        <Link className="btn primary" to="/">先回地圖逛逛</Link>
      </section>
    );
  return (
    <div className="stack">
      <section className="panel hero">
        <h1>{data.provider.name}</h1>
        <p className="muted">把第一次辦好，就是你在龍角鎮唯一的行銷。{data.unansweredQuestions > 0 && <strong> 有 {data.unansweredQuestions} 個問題等你回答。</strong>}</p>
      </section>
      <section className="stack" id="provider-shops">
        <h2>我的店</h2>
        {data.shops.length > 0 && <div className="grid">{data.shops.map((s) => <article key={s.id} className="panel"><div className="row wrap"><DistrictTag k={s.districtKey} /><strong className="grow">{s.name}</strong></div><small>{s.online ? "線上" : s.realAddress}</small></article>)}</div>}
        <ShopForm onDone={reload} primary={!data.shops.length} />
      </section>
      <section className="stack" id="provider-trials">
        <h2>試用機會</h2>
        {data.trials.map((t) => <TrialBox key={t.id} trial={t} reload={reload} />)}
        {data.shops.length ? <TrialForm shops={data.shops} onDone={reload} primary={!data.trials.length} /> : <p className="muted">先開一間店，才能上架試用機會。</p>}
      </section>
      <Questions reloadDash={reload} />
      <Signals />
    </div>
  );
}
