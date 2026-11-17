import { useState } from "react";
import { Link } from "react-router-dom";
import { Empty, ErrorBox, Loading } from "../components/Bits";
import { Dialog } from "../components/Dialog";
import { GrownGate } from "../components/GrownGate";
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

type Product = "claude" | "chatgpt" | "other";

const PRODUCTS: Record<Product, { label: string; steps: string[] }> = {
  claude: {
    label: "Claude",
    steps: [
      "打開 Claude，到「設定」裡找「連接器」，選「新增自訂連接器」。",
      "把剛剛複製的網址貼進去，存起來。",
      "它會帶你到龍角鎮登入，按「同意連接」。回到 Claude 說：「去龍角鎮逛逛。」",
    ],
  },
  chatgpt: {
    label: "ChatGPT",
    steps: [
      "打開 ChatGPT，到「設定」裡找「連接器」（有些版本叫「應用程式」），新增一個自己的連接。",
      "把剛剛複製的網址貼進去，存起來。",
      "它會帶你到龍角鎮登入，按「同意連接」。回到 ChatGPT 說：「去龍角鎮逛逛。」",
    ],
  },
  other: {
    label: "別的聊天",
    steps: [
      "打開你平常用的那個聊天，到設定裡找「連接器」或「整合」。名稱每家不太一樣，找不到的話搜尋一下它的說明。",
      "新增一個自己的連接，把剛剛複製的網址貼進去。",
      "它會帶你到龍角鎮登入，按「同意連接」。回去跟它說：「去龍角鎮逛逛。」",
    ],
  },
};

export function ConnectPage() {
  return <GrownGate><ConnectBody /></GrownGate>;
}

function ConnectBody() {
  const { config, toast } = useSession();
  const url = config?.mcpUrl ?? `${window.location.origin}/mcp`;
  const connections = useFetch<Connection[]>("/api/me/connections");
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, setPending] = useState<Connection | null>(null);
  const [step, setStep] = useState<"intro" | "ask" | Product | "none">("intro");
  const copy = async (text: string, ok = "已複製") => {
    await navigator.clipboard?.writeText(text);
    toast(ok);
  };
  const disconnect = async (c: Connection) => {
    setPending(null);
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
  const product = step in PRODUCTS ? PRODUCTS[step as Product] : null;
  return (
    <div className="stack" style={{ maxWidth: 760, margin: "0 auto" }}>
      <section className="panel stack">
        <h1>會說話的朋友</h1>
        {step === "intro" && (
          <>
            <p>小龍想找一個會說話的朋友，幫牠去鎮上打聽。你平時聊天的那個，可以來串門子。</p>
            <button type="button" className="btn primary" onClick={() => setStep("ask")}>開始連接</button>
          </>
        )}
        {step === "ask" && (
          <>
            <h2>你平常用哪一個聊天？</h2>
            <div className="stack">
              {(Object.keys(PRODUCTS) as Product[]).map((k) => (
                <button key={k} type="button" className="btn primary" onClick={() => setStep(k)}>{PRODUCTS[k].label}</button>
              ))}
              <button type="button" className="btn" onClick={() => setStep("none")}>我沒有在用，先不用</button>
            </div>
          </>
        )}
        {product && (
          <>
            <h2>用 {product.label} 來串門子，三步就好</h2>
            <div className="field">
              <span>龍角鎮的網址</span>
              <div className="row">
                <code className="code grow">{url}</code>
                <button type="button" className="btn small primary" onClick={() => copy(url, "網址已複製")}>複製網址</button>
              </div>
            </div>
            <ol style={{ lineHeight: 1.9 }}>
              {product.steps.map((t) => <li key={t}>{t}</li>)}
            </ol>
            <p className="muted">牠要帶回發現、建議第一步或回報時，會先請你看過再核准。看過再按同意就好。</p>
            <button type="button" className="btn ghost" onClick={() => setStep("ask")}>換一個聊天</button>
          </>
        )}
        {step === "none" && (
          <>
            <p>沒關係，不連也能繼續玩。小龍的鎮上，你自己走走就很好。哪天想找個會說話的朋友，再回來這裡。</p>
            <button type="button" className="btn ghost" onClick={() => setStep("ask")}>我想了想，還是看看</button>
          </>
        )}
        <Link to="/" className="btn ghost">回小龍身邊</Link>
      </section>
      <section className="panel stack">
        <h2>已經連上的朋友</h2>
        <ErrorBox error={connections.error} />
        {connections.loading && !connections.data ? <Loading /> : connections.data?.length ? (
          <ul className="plain">
            {connections.data.map((c) => (
              <li key={c.clientId}>
                <div className="panel soft stack" style={{ gap: 6 }}>
                  <strong>{c.name}</strong>
                  <small>連接時間：{formatDateTime(c.connectedAt)}</small>
                  <small>最後使用：{c.lastUsedAt ? formatDateTime(c.lastUsedAt) : "還沒用過"}</small>
                  <div><button type="button" className="btn small danger" disabled={busy === c.clientId} onClick={() => setPending(c)}>{busy === c.clientId ? "中斷中…" : "中斷連接"}</button></div>
                </div>
              </li>
            ))}
          </ul>
        ) : <Empty>還沒有連上的朋友。連上之後，名字會出現在這裡，你也可以隨時中斷。</Empty>}
      </section>
      <details className="panel advanced">
        <summary>進階</summary>
        <div className="stack">
          <section className="panel stack">
            <h2>用終端機連接 Codex</h2>
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
            <h2>用設定檔的 AI 工具（例如 Cursor）</h2>
            <p>在支援遠端 MCP 的用戶端設定檔裡加入：</p>
            <pre className="code" style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify({ mcpServers: { longjiao: { url } } }, null, 2)}</pre>
          </section>
        </div>
      </details>
      {pending && <Dialog title="中斷連接" onClose={() => setPending(null)}>
        <h2>要中斷「{pending.name}」嗎？</h2>
        <p>中斷後牠就不能再以你的角色進龍角鎮。想再連上，需要重新登入。</p>
        <button type="button" className="btn primary" onClick={() => setPending(null)}>先留著</button>
        <button type="button" className="btn danger" onClick={() => void disconnect(pending)}>中斷「{pending.name}」</button>
      </Dialog>}
    </div>
  );
}
