import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Avatar } from "../components/Avatar";
import { Dialog } from "../components/Dialog";
import { api } from "../lib/api";
import { useSession } from "../lib/session";

type SaveKind = "name" | "personality" | "share";
type ActionKind = SaveKind | "notify" | "logout" | "delete";

export function MePage() {
  const { me, reload } = useSession();
  const [name, setName] = useState(me?.character?.name ?? "");
  const [personality, setPersonality] = useState(me?.character?.personality ?? "");
  const [allow, setAllow] = useState(me?.character?.sharing.allowAiQuotes ?? true);
  const [notify, setNotify] = useState(me?.pet?.notify !== false);
  const [error, setError] = useState<{ kind: ActionKind; message: string } | null>(null);
  const [busy, setBusy] = useState<ActionKind | null>(null);
  const [saved, setSaved] = useState<SaveKind | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const gate = useRef(false);
  if (!me) return null;

  const logout = async () => {
    if (busy) return;
    setBusy("logout");
    setError(null);
    try {
      await api("/api/auth/logout", { method: "POST" });
      window.location.assign("/");
    } catch {
      setError({ kind: "logout", message: "剛剛沒有登出成功。再按一次登出就好。" });
      setBusy(null);
    }
  };
  const remove = async () => {
    if (busy) return;
    setBusy("delete");
    setError(null);
    try {
      await api("/api/me", { method: "DELETE" });
      window.location.assign("/");
    } catch {
      setError({ kind: "delete", message: "帳號還沒刪掉。再按一次試試看。" });
      setBusy(null);
    }
  };
  const save = async (
    kind: SaveKind,
    patch: { name?: string; personality?: string; allow?: boolean },
  ) => {
    if (!me.character || gate.current) return;
    gate.current = true;
    setBusy(kind);
    setSaved(null);
    setError(null);
    try {
      await api("/api/me/character", {
        method: "PUT",
        body: {
          name: patch.name ?? me.character.name,
          appearance: me.character.appearance,
          personality: patch.personality ?? me.character.personality,
          sharing: { allowAiQuotes: patch.allow ?? me.character.sharing.allowAiQuotes },
        },
      });
      await reload();
      setSaved(kind);
    } catch (err) {
      if (kind === "share" && patch.allow !== undefined) setAllow(!patch.allow);
      setError({ kind, message: (err as Error).message });
    } finally {
      gate.current = false;
      setBusy(null);
    }
  };
  const toggleNotify = async (value: boolean) => {
    setNotify(value);
    setBusy("notify");
    setError(null);
    try {
      await api("/api/me/pet", { method: "PATCH", body: { notify: value } });
      await reload();
    } catch {
      setNotify(!value);
      setError({ kind: "notify", message: "提醒沒有改成。再按一次就好。" });
    } finally {
      setBusy(null);
    }
  };
  const savedNote = (kind: SaveKind) => (saved === kind ? <p role="status">存好了。</p> : null);
  const errorNote = (kind: ActionKind) =>
    error?.kind === kind ? (
      <p role="alert" className="error">
        {error.message}
      </p>
    ) : null;

  return (
    <div className="stack settings" style={{ maxWidth: 640, margin: "0 auto" }}>
      <h1>設定</h1>
      {me.character ? (
        <section className="panel stack">
          <div className="row">
            <Avatar appearance={me.character.appearance} name={me.character.name} size={72} />
            <div className="grow">
              <strong>{me.character.name}</strong>
              <small style={{ display: "block" }}>{me.user.email}</small>
            </div>
          </div>
          <label className="field">
            <span>寶寶名字</span>
            <input
              aria-label="寶寶名字"
              value={name}
              maxLength={20}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              aria-label="新消息提醒"
              checked={notify}
              disabled={busy === "notify"}
              aria-busy={busy === "notify"}
              onChange={(e) => void toggleNotify(e.target.checked)}
            />
            新消息提醒
          </label>
          {errorNote("notify")}
          {errorNote("name")}
          {savedNote("name")}
          <button
            type="button"
            className="btn primary"
            disabled={busy === "name"}
            aria-busy={busy === "name"}
            onClick={() => void save("name", { name })}
          >
            {busy === "name" ? "儲存中…" : "存起來"}
          </button>
        </section>
      ) : (
        <section className="panel stack">
          <p>門口那顆蛋還在滾。</p>
          <Link to="/me/character" className="btn primary">
            把牠撿回家
          </Link>
        </section>
      )}
      {errorNote("logout")}
      <button
        type="button"
        className="btn ghost"
        disabled={busy === "logout"}
        aria-busy={busy === "logout"}
        onClick={() => void logout()}
      >
        {busy === "logout" ? "登出中…" : "登出"}
      </button>
      <details className="panel advanced">
        <summary>進階</summary>
        <div className="stack">
          {(me.pet?.stage ?? 0) >= 2 && <Link to="/connect">幫手</Link>}
          {me.character && (
            <>
              <Link to="/me/character">換個造型</Link>
              <label className="field">
                <span>脾氣</span>
                <textarea
                  aria-label="脾氣"
                  value={personality}
                  maxLength={200}
                  rows={2}
                  onChange={(e) => setPersonality(e.target.value)}
                />
              </label>
              {errorNote("personality")}
              {savedNote("personality")}
              <button
                type="button"
                className="btn"
                disabled={busy === "personality"}
                aria-busy={busy === "personality"}
                onClick={() => void save("personality", { personality })}
              >
                {busy === "personality" ? "儲存中…" : "把脾氣存起來"}
              </button>
              <label className="check">
                <input
                  type="checkbox"
                  aria-busy={busy === "share"}
                  disabled={busy === "share"}
                  checked={allow}
                  onChange={(e) => {
                    setAllow(e.target.checked);
                    void save("share", { allow: e.target.checked });
                  }}
                />
                做過的事可以說給鎮上的朋友聽
              </label>
              {errorNote("share")}
              {savedNote("share")}
            </>
          )}
          <Link to="/provider">開一間小店</Link>
          <Link to="/terms">服務條款</Link>
          <Link to="/privacy">隱私權政策</Link>
          {me.user.roles.includes("admin") && <Link to="/admin">管理</Link>}
          <button type="button" className="btn danger" onClick={() => setConfirmDelete(true)}>
            刪除帳號
          </button>
        </div>
      </details>
      {confirmDelete && (
        <Dialog title="刪除帳號" busy={busy === "delete"} onClose={() => setConfirmDelete(false)}>
          <h2>要刪掉這個帳號嗎？</h2>
          <p>小龍和做過的事都會不見。</p>
          {errorNote("delete")}
          <button
            type="button"
            className="btn primary"
            disabled={busy === "delete"}
            onClick={() => setConfirmDelete(false)}
          >
            先留著
          </button>
          <button
            type="button"
            className="btn danger"
            disabled={busy === "delete"}
            aria-busy={busy === "delete"}
            onClick={() => void remove()}
          >
            {busy === "delete" ? "刪掉中…" : "刪掉小龍和所有紀錄"}
          </button>
        </Dialog>
      )}
    </div>
  );
}
