import { useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { useSession } from "../lib/session";

const safeNext = (n: string | null) => (n && n.startsWith("/") && !n.startsWith("//") ? n : "/");

export function LoginPage() {
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const { config, configError, reloadConfig } = useSession();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const devLogin = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api("/api/auth/dev-login", { method: "POST", body: { email, name: name || undefined } });
      window.location.assign(next);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="stack" style={{ maxWidth: 440, margin: "24px auto" }}>
      <section className="panel stack">
        <h1>登入後就能把寶寶帶回家</h1>
        {next.startsWith("/oauth/") && <p className="notice">你的 AI 用戶端想連接龍角鎮，登入後會請你確認。</p>}
        {params.get("error") === "google_unavailable" && <p role="status" className="notice">Google 登入尚未開放，請使用下方的開發用登入。</p>}
        {!config && !configError && <p role="status">正在確認可以使用的登入方式……</p>}
        {configError && <div className="stack"><p role="alert">暫時無法取得登入方式，請再試一次。</p><button className="btn primary" onClick={() => void reloadConfig()}>重新載入登入方式</button></div>}
        {config?.googleLogin && (
          <a className="btn primary" href={`/auth/google/start?next=${encodeURIComponent(next)}`}>
            使用 Google 帳號登入
          </a>
        )}
        <small>
          登入即表示你同意<a href="/terms">服務條款</a>與<a href="/privacy">隱私權政策</a>。
        </small>
      </section>
      {config?.devLogin && (
        <form className="panel soft stack" onSubmit={devLogin} aria-label="開發用登入">
          <h2>開發用登入</h2>
          <p className="muted">這是測試用入口。填入你的 Email 和名字，就能進鎮體驗，不需要密碼。</p>
          <label className="field">
            <span>Email</span>
            <input aria-label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="field">
            <span>名字</span>
            <input aria-label="名字" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          {error && <p role="alert" className="error">{error}</p>}
          <button className={`btn ${config.googleLogin ? "ghost" : "primary"}`} type="submit">開發用登入</button>
        </form>
      )}
    </div>
  );
}
