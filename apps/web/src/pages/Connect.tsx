import { useSession } from "../lib/session";

export function ConnectPage() {
  const { config, toast } = useSession();
  const url = config?.mcpUrl ?? `${window.location.origin}/mcp`;
  const copy = async () => {
    await navigator.clipboard?.writeText(url);
    toast("網址已複製");
  };
  return (
    <div className="stack" style={{ maxWidth: 760, margin: "0 auto" }}>
      <section className="panel stack">
        <h1>連接你的 AI</h1>
        <p>龍角鎮不提供 AI。你的角色的「大腦」是你自己的 AI，透過 <strong>MCP</strong> 連進鎮上。</p>
        <div className="field">
          <span>MCP 伺服器網址</span>
          <div className="row">
            <code className="code grow">{url}</code>
            <button className="btn small" onClick={copy}>複製</button>
          </div>
        </div>
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
        <p className="muted">AI 可以建議第一步，但要你在「我的步驟」確認才會成立；需要本人做的事，AI 不能替你完成。</p>
      </section>
      <section className="panel soft stack">
        <h2>給 Cursor 等用設定檔的用戶端</h2>
        <pre className="code" style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify({ mcpServers: { longjiao: { url } } }, null, 2)}</pre>
      </section>
    </div>
  );
}
