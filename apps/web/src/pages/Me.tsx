import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Avatar } from "../components/Avatar";
import { api } from "../lib/api";
import { useSession } from "../lib/session";

export function MePage() {
  const { me, reload } = useSession();
  const [name, setName] = useState(me?.character?.name ?? "");
  const [personality, setPersonality] = useState(me?.character?.personality ?? "");
  const [allow, setAllow] = useState(me?.character?.sharing.allowAiQuotes ?? true);
  const [notify, setNotify] = useState(me?.pet?.notify !== false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const gate = useRef(false);
  if (!me) return null;
  const logout = async () => {
    await api("/api/auth/logout", { method: "POST" });
    window.location.assign("/");
  };
  const remove = async () => {
    if (!window.confirm("小龍和做過的事都會不見。真的要刪嗎？")) return;
    await api("/api/me", { method: "DELETE" });
    window.location.assign("/");
  };
  const saveName = async () => {
    if (!me.character || gate.current) return;
    gate.current = true;
    setBusy(true);
    setSaved(false);
    setError("");
    try {
      await api("/api/me/character", {
        method: "PUT",
        body: { name, appearance: me.character.appearance, personality, sharing: { allowAiQuotes: allow } },
      });
      await reload();
      setSaved(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      gate.current = false;
      setBusy(false);
    }
  };
  const toggleNotify = async (value: boolean) => {
    setNotify(value);
    await api("/api/me/pet", { method: "PATCH", body: { notify: value } });
    await reload();
  };
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
            <input aria-label="寶寶名字" value={name} maxLength={20} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="check">
            <input type="checkbox" checked={notify} onChange={(e) => void toggleNotify(e.target.checked)} />
            新消息提醒
          </label>
          {error && <p role="alert" className="error">{error}</p>}
          {saved && <p role="status">存好了。</p>}
          <button type="button" className="btn primary" disabled={busy} aria-busy={busy} onClick={() => void saveName()}>{busy ? "儲存中…" : "儲存名字"}</button>
        </section>
      ) : (
        <section className="panel stack">
          <p>門口那顆蛋還在滾。</p>
          <Link to="/me/character" className="btn primary">把牠撿回家</Link>
        </section>
      )}
      <button type="button" className="btn ghost" onClick={() => void logout()}>登出</button>
      <details className="panel advanced">
        <summary>進階</summary>
        <div className="stack">
          <Link to="/connect">幫手</Link>
          {me.character && (
            <>
              <Link to="/me/character">換個造型</Link>
              <label className="field">
                <span>脾氣</span>
                <textarea aria-label="脾氣" value={personality} maxLength={200} rows={2} onChange={(e) => setPersonality(e.target.value)} />
              </label>
              <label className="check">
                <input type="checkbox" checked={allow} onChange={(e) => setAllow(e.target.checked)} />
                做過的事可以說給鎮上的朋友聽
              </label>
            </>
          )}
          <Link to="/provider">開一間小店</Link>
          <Link to="/terms">服務條款</Link>
          <Link to="/privacy">隱私權政策</Link>
          {me.user.roles.includes("admin") && <Link to="/admin">管理</Link>}
          <button type="button" className="btn danger" onClick={() => void remove()}>刪除帳號</button>
        </div>
      </details>
    </div>
  );
}
