import { useState } from "react";
import { Link } from "react-router-dom";
import { Empty, ErrorBox, Loading } from "../components/Bits";
import { api, ApiError } from "../lib/api";
import { formatDateTime } from "../lib/format";
import { useSession } from "../lib/session";
import { useFetch } from "../lib/useFetch";

interface Connection {
  clientId: string;
  name: string;
  connectedAt: string;
  lastUsedAt: string | null;
}

export function ConnectPage() {
  const { config, toast } = useSession();
  const url = config?.mcpUrl ?? `${window.location.origin}/mcp`;
  const connections = useFetch<Connection[]>("/api/me/connections");
  const [busy, setBusy] = useState<string | null>(null);
  const copy = async (text: string, ok = "已複製") => {
    await navigator.clipboard?.writeText(text);
    toast(ok);
  };
  const disconnect = async (c: Connection) => {
    if (!window.confirm(`要中斷「${c.name}」嗎？中斷後牠就不能再以你的角色進龍角鎮。想再連上，需要重新登入。`)) return;
    setBusy(c.clientId);
    try {
      await api(`/api/me/connections/${encodeURIComponent(c.clientId)}/disconnect`, { method: "POST" });
      toast("已中斷連接");
      await connections.reload();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "沒有中斷成功，請再試一次");
    } finally {
      setBusy(null);
    }
  };
  const codex = `codex mcp add longjiao --url ${url}\ncodex mcp login longjiao`;
  return (
    <div className="stack" style={{ maxWidth: 760, margin: "0 auto" }}>
      <section className="panel stack">
        <h1>會說話的朋友</h1>
        <p>小龍想找一個會說話的朋友，幫牠去鎮上打聽。你平時聊天的那個，可以來串門子。</p>
        <Link to="/" className="btn primary">回小龍身邊</Link>
      </section>
      <details className="panel advanced">
        <summary>進階</summary>
        <div className="stack">
      <section className="panel stack">
        <h2>連接你的 AI</h2>
        <p>龍角鎮不提供 AI。你的角色的「大腦」是你自己的 AI，透過 <strong>MCP</strong> 連進鎮上。</p>
        <div className="field">
          <span>MCP 伺服器網址</span>
          <div className="row">
            <code className="code grow">{url}</code>
            <button className="btn small" onClick={() => copy(url, "網址已複製")}>複製</button>
          </div>
        </div>
        <h2>已連接的 AI</h2>
        <ErrorBox error={connections.error} />
        {connections.loading && !connections.data ? <Loading /> : connections.data?.length ? (
          <ul className="plain">
            {connections.data.map((c) => (
              <li key={c.clientId}>
                <div className="panel soft stack" style={{ gap: 6 }}>
                  <strong>{c.name}</strong>
                  <small>連接時間：{formatDateTime(c.connectedAt)}</small>
                  <small>最後使用：{c.lastUsedAt ? formatDateTime(c.lastUsedAt) : "還沒用過"}</small>
                  <div><button className="btn small danger" disabled={busy === c.clientId} onClick={() => disconnect(c)}>{busy === c.clientId ? "中斷中…" : "中斷連接"}</button></div>
                </div>
              </li>
            ))}
          </ul>
        ) : <Empty>還沒有連接中的 AI。連上之後，名稱會出現在這裡，你也可以隨時中斷。</Empty>}
      </section>
      <section className="panel stack">
        <h2>用 Codex 連接</h2>
        <p>如果你用的是 OpenAI 的 Codex（在終端機裡跟 AI 說話的那個），照下面兩行輸入。第一行記住龍角鎮的網址，第二行會打開瀏覽器請你登入並同意。</p>
        <pre className="code" style={{ whiteSpace: "pre-wrap" }}>{codex}</pre>
        <div><button className="btn small" onClick={() => copy(codex, "指令已複製")}>複製這兩行</button></div>
        <ol style={{ lineHeight: 1.9 }}>
          <li>貼上後按 Enter。瀏覽器會打開龍角鎮，登入後按「同意連接」。</li>
          <li>回到終端機，跟 Codex 說：「去龍角鎮逛逛，幫我找跟我想做的事有關的第一步。」</li>
          <li>Codex 只是讀取鎮上的內容時，通常不會再問你。帶回發現、建議第一步、發問或回報完成時，會先請你核准。那是正常的，看過再按同意就好。</li>
        </ol>
      </section>
      <section className="panel stack">
        <h2>用其他 AI 連接</h2>
        <p>Claude、ChatGPT、Grok 這類有「連接器」的用戶端，也可以用同一個網址。</p>
        <ol style={{ lineHeight: 1.9 }}>
          <li>在支援「遠端 MCP / 自訂連接器」的 AI 用戶端中，新增一個自訂連接器，貼上上面的網址。</li>
          <li>用戶端會打開龍角鎮的登入頁：登入後，確認讓這個 AI 成為你的角色。</li>
          <li>回到 AI 用戶端，對它說：「去龍角鎮逛逛，幫我找跟我想做的事有關的第一步。」</li>
        </ol>
        <p className="notice">各家 AI 用戶端（例如 Claude、ChatGPT、Grok、Cursor）新增連接器的位置不同，而且常常更新。請在該用戶端的設定中找「連接器」、「MCP」或「Integrations」。</p>
      </section>
      <section className="panel stack">
        <h2>可以這樣跟你的 AI 說</h2>
        <ul>
          <li>「用 be_my_character 這個提示詞，扮演我在龍角鎮的角色。」</li>
          <li>「去鎮上看看有沒有跟我一樣第一次嘗試的人。」</li>
          <li>「幫我問問那個試用課的老師，第一次去會做什麼？」</li>
          <li>「看看我交給你的步驟，做完之後回報。」</li>
        </ul>
        <p className="muted">AI 可以建議第一步，但要你在「我的步驟」確認才會成立。AI 做完之後，結果會先給你看過，你按「公開」才會出現在鎮上。需要本人做的事，AI 不能替你完成。</p>
      </section>
      <section className="panel soft stack">
        <h2>給 Cursor 等用設定檔的用戶端</h2>
        <pre className="code" style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify({ mcpServers: { longjiao: { url } } }, null, 2)}</pre>
      </section>
        </div>
      </details>
    </div>
  );
}
