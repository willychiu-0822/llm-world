import { useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Celebrate } from "../components/Celebrate";
import { ErrorBox, Loading } from "../components/Bits";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import type { Step } from "../lib/types";
import { useFetch } from "../lib/useFetch";
import type { Sticker } from "@lj/core";

export function TriesPage() {
  const { me, reload } = useSession();
  const nav = useNavigate();
  const hello = Boolean((useLocation().state as { hello?: boolean } | null)?.hello);
  const { data, error, loading, reload: reloadSteps } = useFetch<Step[]>("/api/first-steps?status=confirmed");
  const [active, setActive] = useState<Step | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [drawer, setDrawer] = useState("");
  const gate = useRef(false);

  const finish = async (sticker?: Sticker) => {
    if (!active || gate.current) return;
    gate.current = true;
    setBusy(true);
    setFormError("");
    try {
      await api(`/api/first-steps/${active.id}/complete`, { method: "POST", body: { noteAfter: sticker, noteShared: false, visibility: "public" } });
      const deedId = active.sourceDeedIds[0];
      if (sticker && deedId) {
        try {
          await api("/api/me/pet", { method: "PATCH", body: { mood: { deedId, sticker } } });
        } catch {
          /* the star still counts if the sticker could not stick */
        }
      }
      await reload();
      setActive(null);
      nav("/");
    } catch (err) {
      setFormError((err as Error).message || "咦，小龍迷路了。再試一次？");
      gate.current = false;
      setBusy(false);
    }
  };

  const drop = async (step: Step) => {
    await api(`/api/first-steps/${step.id}/drop`, { method: "POST" });
    setDrawer("小龍把它塞進抽屜了。");
    await reloadSteps();
  };

  if (loading && !data) return <Loading />;
  const list = data ?? [];
  return (
    <div className="stack">
      <h1>我接下的事</h1>
      {hello && <p className="notice" role="status">我幫你記著喔。</p>}
      {drawer && <p className="notice" role="status">{drawer}</p>}
      <ErrorBox error={error} />
      {!list.length ? (
        <div className="empty">
          <p>還沒有接下的事。</p>
          <Link to="/">回小龍身邊</Link>
        </div>
      ) : (
        <ul className="plain">
          {list.map((step) => (
            <li key={step.id}>
              <article className="panel stack">
                <h2>「{step.text}」</h2>
                <button type="button" className="btn primary" onClick={() => { setFormError(""); setActive(step); }}>我做到了！</button>
                <details className="more">
                  <summary>…</summary>
                  <button type="button" className="btn ghost" onClick={() => void drop(step)}>先收進抽屜</button>
                </details>
              </article>
            </li>
          ))}
        </ul>
      )}
      {active && (
        <Celebrate
          fromStars={me?.pet?.stars ?? 0}
          error={formError}
          busy={busy}
          onClaim={(sticker) => void finish(sticker)}
          onDismiss={() => { if (!busy) { setActive(null); setFormError(""); } }}
        />
      )}
    </div>
  );
}
