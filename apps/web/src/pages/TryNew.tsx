import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ErrorBox, Loading } from "../components/Bits";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import type { DeedView } from "../lib/types";
import { useFetch } from "../lib/useFetch";

export function TryNewPage() {
  const [params] = useSearchParams();
  const deedId = params.get("deed") ?? undefined;
  const deed = useFetch<DeedView>(deedId ? `/api/deeds/${deedId}` : null);
  const nav = useNavigate();
  const { reload } = useSession();
  const [text, setText] = useState("");
  const [ready, setReady] = useState(!deedId);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (deed.data && !ready) {
      setText(deed.data.title);
      setReady(true);
    }
  }, [deed.data, ready]);

  if (deedId && deed.loading && !deed.data && !deed.error) return <Loading />;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/first-steps", { method: "POST", body: { executor: "self", text, sourceDeedIds: deedId ? [deedId] : [] } });
      await reload();
      nav("/tries", { state: { hello: true } });
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg.includes("事蹟") || msg.includes("參考") ? "這顆信物先放著。換一顆摸摸看？" : "咦，小龍迷路了。再試一次？");
      setBusy(false);
    }
  };
  return (
    <form className="stack try-new" onSubmit={submit} aria-label="接下這件事">
      <h1>我也去摸摸看</h1>
      <p>小龍：「寫你要做的就好，我幫你記著。」</p>
      <ErrorBox error={deed.error} />
      <label className="field">
        <span>我要做的是</span>
        <input aria-label="我要做的是" value={text} onChange={(e) => setText(e.target.value)} maxLength={200} required />
      </label>
      {error && <p role="alert" className="error">{error}</p>}
      <button className="btn primary" type="submit" disabled={busy || !text.trim()}>好，接下了！</button>
    </form>
  );
}
