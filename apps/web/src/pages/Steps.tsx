import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Empty, ErrorBox, ExecutorTag, Loading } from "../components/Bits";
import { api } from "../lib/api";
import { formatDateTime } from "../lib/format";
import { useSession } from "../lib/session";
import type { Step } from "../lib/types";
import { useFetch } from "../lib/useFetch";

type Tab = "draft" | "confirmed" | "done";
const TABS: { key: Tab; label: string }[] = [
  { key: "draft", label: "AI 的建議" },
  { key: "confirmed", label: "進行中" },
  { key: "done", label: "完成了" },
];

function NoteEditor({ step, kind, onSaved }: { step: Step; kind: "before" | "after"; onSaved(): void }) {
  const cur = step.notes[kind];
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState(cur?.body ?? "");
  const [shared, setShared] = useState(cur?.shared ?? false);
  const label = kind === "before" ? "做之前的隨筆" : "做之後的隨筆";
  const save = async (e: FormEvent) => {
    e.preventDefault();
    await api(`/api/first-steps/${step.id}/notes/${kind}`, { method: "PUT", body: { body, shared } });
    setOpen(false);
    onSaved();
  };
  if (!open)
    return (
      <div className={kind === "before" ? "before" : "after"}>
        <small>{label}{cur?.shared ? "（已分享）" : "（只有自己看得到）"}</small>
        <p style={{ whiteSpace: "pre-wrap" }}>{cur?.body || <span className="muted">（還沒寫，不寫也沒關係）</span>}</p>
        <button className="btn small ghost" onClick={() => setOpen(true)}>{cur ? "編輯" : "寫一點"}</button>
      </div>
    );
  return (
    <form className={`${kind === "before" ? "before" : "after"} stack`} style={{ gap: 6 }} onSubmit={save}>
      <label className="field">
        <span>{label}</span>
        <textarea aria-label={label} value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={2000} />
      </label>
      <label className="check"><input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} />分享到事蹟，讓後來的人看到</label>
      <div className="row"><button className="btn small" type="submit">儲存</button><button className="btn small ghost" type="button" onClick={() => setOpen(false)}>取消</button></div>
    </form>
  );
}

function CompleteForm({ step, onDone, onCancel }: { step: Step; onDone(): void; onCancel(): void }) {
  const [noteAfter, setNoteAfter] = useState("");
  const [noteShared, setNoteShared] = useState(false);
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [error, setError] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api(`/api/first-steps/${step.id}/complete`, { method: "POST", body: { noteAfter: noteAfter || undefined, noteShared, visibility } });
      onDone();
    } catch (err) {
      setError((err as Error).message);
    }
  };
  return (
    <form className="panel soft stack" onSubmit={submit} aria-label="完成這一步">
      <strong>你做到了！想留下什麼嗎？</strong>
      <label className="field">
        <span>做之後的隨筆（選填）</span>
        <textarea aria-label="做之後的隨筆（選填）" value={noteAfter} onChange={(e) => setNoteAfter(e.target.value)} rows={3} maxLength={2000} placeholder="發生了什麼？跟想像的哪裡不一樣？" />
      </label>
      <label className="check"><input type="checkbox" checked={noteShared} onChange={(e) => setNoteShared(e.target.checked)} />把這段隨筆分享到事蹟</label>
      <fieldset className="row wrap" style={{ border: "none", padding: 0 }}>
        <legend className="sr-only">事蹟可見度</legend>
        <label className="check"><input type="radio" name={`vis-${step.id}`} checked={visibility === "public"} onChange={() => setVisibility("public")} />公開到鎮上（成為別人的發現）</label>
        <label className="check"><input type="radio" name={`vis-${step.id}`} checked={visibility === "private"} onChange={() => setVisibility("private")} />只有自己看得到</label>
      </fieldset>
      {error && <p role="alert" className="error">{error}</p>}
      <div className="row wrap"><button className="btn primary" type="submit">完成</button><button className="btn ghost" type="button" onClick={onCancel}>取消</button></div>
    </form>
  );
}

function StepItem({ step, reload, onCompleted, highlighted, completing, onStart, onCancel, primary }: { step: Step; reload(): void; onCompleted(id: string): void; highlighted: boolean; completing: boolean; onStart(): void; onCancel(): void; primary: boolean }) {
  const { toast, reload: reloadMe } = useSession();
  const completedCard = useRef<HTMLElement>(null);
  useEffect(() => { if (highlighted) completedCard.current?.scrollIntoView({ block: "start" }); }, [highlighted]);
  const act = async (path: string, msg: string) => {
    await api(`/api/first-steps/${step.id}/${path}`, { method: "POST" });
    toast(msg);
    reload();
    void reloadMe();
  };
  const when = step.session?.startsAt ?? step.plannedAt;
  return (
    <li>
      <article ref={completedCard} className={`panel stack ${highlighted ? "just-completed" : ""}`} style={{ gap: 10 }}>
        {highlighted && <strong className="notice">剛剛完成的這一步</strong>}
        <div className="row wrap" style={{ gap: 6 }}>
          <ExecutorTag executor={step.executor} />
          {step.proposedBy === "ai" && <span className="tag tag-ai">AI 建議</span>}
          {step.attended && <span className="tag tag-self">提供者已確認出席</span>}
        </div>
        <h3 style={{ margin: 0 }}>「{step.text}」</h3>
        {step.proposalReason && <p className="muted">AI 的理由：{step.proposalReason}</p>}
        {step.trial && <p>試用機會：<Link to={`/trials/${step.trial.id}`}>{step.trial.title}</Link></p>}
        {(when || step.where) && <p>🗓 {when ? formatDateTime(when) : ""}{step.where ? `・${step.where}` : ""}</p>}
        {step.result && <div className="bubble"><small>AI 角色帶回的結果</small><p style={{ whiteSpace: "pre-wrap" }}>{step.result}</p></div>}

        {step.status !== "draft" && (
          <div className="notes-pair">
            <NoteEditor step={step} kind="before" onSaved={reload} />
            {step.status === "done" ? <NoteEditor step={step} kind="after" onSaved={reload} /> : <div className="after"><small>做之後的隨筆</small><p className="muted">做完之後再寫</p></div>}
          </div>
        )}

        <div className="row wrap">
          {step.status === "draft" && (
            <>
              <button className={`btn ${primary ? "primary" : "ghost"}`} onClick={() => act("confirm", "這一步成立了")}>確認這一步</button>
              <button className="btn ghost" onClick={() => act("drop", "已放下")}>不要</button>
            </>
          )}
          {step.status === "confirmed" && step.executor === "self" && !completing && (
            <button className={`btn ${primary ? "primary" : "ghost"}`} onClick={onStart}>我做到了</button>
          )}
          {step.status === "confirmed" && step.executor === "ai" && (
            <p className="muted grow">等你的 AI 角色完成。可以在 AI 用戶端說：「看看我交給你的步驟。」</p>
          )}
          {step.status === "confirmed" && when && <a className="btn ghost small" href={`/api/first-steps/${step.id}/ics`}>加入行事曆</a>}
          {step.status === "confirmed" && <button className="btn ghost small" onClick={() => act("drop", "先放下也沒關係")}>先放下</button>}
          {step.status === "done" && step.deedId && <Link className={`btn small ${primary ? "primary" : "ghost"}`} to={`/deeds/${step.deedId}`}>看看這個事蹟</Link>}
        </div>
        {completing && <CompleteForm step={step} onCancel={onCancel} onDone={() => { onCancel(); toast("太好了！這成為你的新事蹟"); onCompleted(step.id); void reloadMe(); }} />}
      </article>
    </li>
  );
}

export function StepsPage() {
  const [tab, setTab] = useState<Tab>("confirmed");
  const [completedId, setCompletedId] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const { data, error, loading, reload } = useFetch<Step[]>("/api/first-steps");
  const list = (data ?? []).filter((s) => s.status === tab);
  const primaryId = list.find(s => s.status === "draft" || (s.status === "confirmed" && s.executor === "self") || (s.status === "done" && s.deedId))?.id;
  const count = (t: Tab) => (data ?? []).filter((s) => s.status === t).length;
  return (
    <div className="stack" style={{ maxWidth: 760, margin: "0 auto" }}>
      <div className="row wrap">
        <h1 className="grow">我的步驟</h1>
        <Link to="/steps/new" className={`btn ${!primaryId && !completingId ? "primary" : "ghost"}`}>定義新的一步</Link>
      </div>
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => { setTab(t.key); setCompletingId(null); }}>
            {t.label}（{count(t.key)}）
          </button>
        ))}
      </div>
      <ErrorBox error={error} />
      {loading && !data ? <Loading /> : list.length ? <ul className="plain">{list.map((s) => <StepItem key={s.id} step={s} primary={!completingId && s.id === primaryId} completing={completingId === s.id} onStart={() => setCompletingId(s.id)} onCancel={() => setCompletingId(null)} reload={reload} highlighted={s.id === completedId} onCompleted={(id) => { setCompletedId(id); setTab("done"); reload(); }} />)}</ul> : (
        <Empty>
          {tab === "draft" ? <>AI 角色還沒有建議。先<Link to="/connect">連接你的 AI</Link>，請牠找一個小小的第一步。</> : tab === "confirmed" ? <>沒有進行中的步驟。去<Link to="/">地圖</Link>看看大家的第一步吧。</> : <>還沒有完成的步驟。到<button className="text-link" onClick={() => setTab("confirmed")}>進行中</button>選一步，做完再回來看看。</>}
        </Empty>
      )}
    </div>
  );
}
