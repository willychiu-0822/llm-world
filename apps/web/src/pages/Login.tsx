import { useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { useSession } from "../lib/session";

const safeNext = (n: string | null) => (n && n.startsWith("/") && !n.startsWith("//") ? n : "/");

export function LoginPage() {
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const { config } = useSession();
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
        <h1>進入龍角鎮</h1>
        <p className="muted">登入後，你可以設定角色、接上自己的 AI，並在鎮上留下你的第一步。</p>
        {next.startsWith("/oauth/") && <p className="notice">你的 AI 用戶端想連接龍角鎮，登入後會請你確認。</p>}
        {(config?.googleLogin ?? true) && (
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
          <p className="muted">只在開發與測試環境出現，正式環境不會有。</p>
          <label className="field">
            <span>Email</span>
            <input aria-label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="field">
            <span>名字</span>
            <input aria-label="名字" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          {error && <p role="alert" className="error">{error}</p>}
          <button className="btn" type="submit">開發用登入</button>
        </form>
      )}
    </div>
  );
}
