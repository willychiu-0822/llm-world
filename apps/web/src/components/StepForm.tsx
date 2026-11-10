import { DISTRICT_BY_KEY, type DistrictKey } from "@lj/core";
import { useState, type FormEvent } from "react";
import { formatDateTime } from "../lib/format";
import type { Predecessor, Session, Want } from "../lib/types";

export interface StepPayload {
  executor: "ai" | "self";
  text: string;
  wantId?: string;
  sourceDeedIds: string[];
  trialId?: string;
  sessionId?: string;
  plannedAt?: string;
  where?: string;
  noteBefore?: string;
}

export function StepForm(props: {
  wants: Want[];
  predecessors: Predecessor[];
  hints?: { ai: string; self: string } | null;
  sessions?: Session[];
  trialId?: string;
  sourceDistrictKey?: string;
  trialPlace?: { name: string; districtKey: string };
  initialExecutor?: "ai" | "self";
  initialWantId?: string;
  initialSourceIds?: string[];
  submitting?: boolean;
  onSubmit(p: StepPayload): void;
}) {
  const active = props.wants.filter((w) => w.status !== "dropped");
  const [executor, setExecutor] = useState<"ai" | "self">(props.initialExecutor ?? "self");
  const [text, setText] = useState("");
  const [wantId, setWantId] = useState(props.initialWantId ?? active[0]?.id ?? "");
  const [sources, setSources] = useState<string[]>(props.initialSourceIds ?? []);
  const [sessionId, setSessionId] = useState("");
  const [when, setWhen] = useState("");
  const [where, setWhere] = useState("");
  const [noteBefore, setNoteBefore] = useState("");
  const [error, setError] = useState("");

  const reference = (p: Predecessor) => {
    setText(p.text);
    setSources((s) => (s.includes(p.deedId) ? s : [...s, p.deedId]));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) {
      setError("寫下一個小小的第一步，例如「先問清楚會發生什麼」。");
      return;
    }
    setError("");
    const p: StepPayload = { executor, text: text.trim(), sourceDeedIds: sources };
    if (wantId) p.wantId = wantId;
    if (props.trialId) p.trialId = props.trialId;
    if (executor === "self") {
      if (sessionId) p.sessionId = sessionId;
      if (when) p.plannedAt = `${when}:00+08:00`;
      if (where.trim()) p.where = where.trim();
    }
    if (noteBefore.trim()) p.noteBefore = noteBefore.trim();
    props.onSubmit(p);
  };

  const sessions = props.sessions ?? [];
  const selectedWant = active.find(w => w.id === wantId);
  const destination = props.trialPlace?.name ?? DISTRICT_BY_KEY[(selectedWant?.districtKey ?? props.sourceDistrictKey ?? "misc") as DistrictKey]?.publicPlaceName ?? "萬事屋門口";
  return (
    <form className="stack" onSubmit={submit} noValidate>
      {props.predecessors.length > 0 && (
        <section className="panel soft">
          <h3>前人的第一步</h3>
          <ul className="plain">
            {props.predecessors.map((p) => (
              <li key={p.deedId} className="predecessor">
                <span className={`tag ${p.executor === "ai" ? "tag-ai" : "tag-self"}`}>{p.executor === "ai" ? "AI 執行" : "本人執行"}</span>
                {p.isDemo && <span className="tag tag-demo">示範</span>}
                <span className="grow">
                  「{p.text}」<small className="muted"> — {p.characterName ?? "某位鎮民"}</small>
                </span>
                <button type="button" className="btn small ghost" onClick={() => reference(p)} aria-pressed={sources.includes(p.deedId)}>
                  {sources.includes(p.deedId) ? "已參考" : "參考這一步"}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {props.hints && (props.hints.ai || props.hints.self) && (
        <section className="panel soft">
          <h3>提供者建議的第一步</h3>
          {props.hints.ai && (
            <p>
              <span className="tag tag-ai">AI</span> {props.hints.ai}{" "}
              <button type="button" className="btn small ghost" onClick={() => { setExecutor("ai"); setText(props.hints!.ai); }}>
                用這個
              </button>
            </p>
          )}
          {props.hints.self && (
            <p>
              <span className="tag tag-self">本人</span> {props.hints.self}{" "}
              <button type="button" className="btn small ghost" onClick={() => { setExecutor("self"); setText(props.hints!.self); }}>
                用這個
              </button>
            </p>
          )}
        </section>
      )}

      <fieldset className="choice">
        <legend>這一步由誰來做？</legend>
        <label className={`choice-card ${executor === "ai" ? "on" : ""}`}>
          <input type="radio" name="executor" value="ai" checked={executor === "ai"} onChange={() => setExecutor("ai")} />
          <strong>交給 AI 角色</strong>
          <small>在鎮上先試做、打聽、研究</small>
        </label>
        <label className={`choice-card ${executor === "self" ? "on" : ""}`}>
          <input type="radio" name="executor" value="self" checked={executor === "self"} onChange={() => setExecutor("self")} />
          <strong>本人去做</strong>
          <small>在生活中實際做一件小事</small>
        </label>
      </fieldset>

      <label className="field">
        <span>第一步</span>
        <textarea aria-label="第一步" value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={200} placeholder="小到一次就能完成，例如：先問清楚試用課會做什麼" />
      </label>

      {active.length > 0 && (
        <label className="field">
          <span>這一步屬於哪件想做的事？</span>
          <select aria-label="想做的事" value={wantId} onChange={(e) => setWantId(e.target.value)}>
            {active.map((w) => (
              <option key={w.id} value={w.id}>
                {w.text}
              </option>
            ))}
            <option value="">{props.sourceDistrictKey ? "沿用那件事的地方" : "先不指定（放在萬事屋）"}</option>
          </select>
        </label>
      )}

      <p className="notice" role="status">完成後，這件事會留在「{destination}」。<small>{props.trialPlace ? "試用留下的會在店裡；想做的事仍可自由選。" : selectedWant ? "依你選的想做的事決定地方。" : props.sourceDistrictKey ? "沒指定想做的事時，沿用那件事的地方。" : "先不分類也沒關係。"}</small></p>

      {executor === "self" && (
        <>
          {sessions.length > 0 && (
            <label className="field">
              <span>報名場次</span>
              <select aria-label="報名場次" value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
                <option value="">先不報名</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id} disabled={s.remaining === 0}>
                    {formatDateTime(s.startsAt)}（剩 {s.remaining} 位）
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="row wrap">
            <label className="field grow">
              <span>什麼時候</span>
              <input aria-label="什麼時候" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
            </label>
            <label className="field grow">
              <span>在哪裡</span>
              <input aria-label="在哪裡" value={where} onChange={(e) => setWhere(e.target.value)} maxLength={100} placeholder="例如：音樂坊、家裡客廳" />
            </label>
          </div>
        </>
      )}

      <label className="field">
        <span>做之前的話（選填，只有自己看得到）</span>
        <textarea aria-label="做之前的話（選填，只有自己看得到）" value={noteBefore} onChange={(e) => setNoteBefore(e.target.value)} rows={3} maxLength={2000} placeholder="現在的心情、擔心或期待都可以" />
      </label>

      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <button type="submit" className="btn primary" disabled={props.submitting}>
        確定這一步
      </button>
    </form>
  );
}
