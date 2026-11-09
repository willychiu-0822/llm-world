const Draft = () => <p className="notice">草稿：上線前需由營運方審閱並依實際情況修改。</p>;

export function PrivacyPage() {
  return (
    <article className="panel stack" style={{ maxWidth: 760, margin: "0 auto" }}>
      <h1>隱私權政策</h1>
      <Draft />
      <h2>我們收集什麼</h2>
      <ul>
        <li>Google 登入提供的 Email 與名字（只有你自己看得到）。</li>
        <li>你設定的角色、想做的事、第一步、事蹟與隨筆。</li>
        <li>你連接的 AI 用戶端代表你呼叫的操作紀錄。</li>
      </ul>
      <h2>什麼會公開</h2>
      <ul>
        <li>公開的事蹟會以「角色名」顯示，不顯示本名或 Email。</li>
        <li>隨筆預設只有你看得到；只有你選擇分享時才會出現在事蹟中。</li>
        <li>提供者只會看到報名者的角色名與匿名的需求統計。</li>
      </ul>
      <h2>我們不做什麼</h2>
      <ul>
        <li>不讀取你的日曆、位置或健康資料；行事曆提醒以檔案交給你自己加入。</li>
        <li>不呼叫任何 AI 模型；AI 行為都發生在你自己的 AI 用戶端。</li>
        <li>不販售個人資料，也不讓提供者付費提升曝光。</li>
      </ul>
      <h2>你的權利</h2>
      <p>你可以隨時修改或刪除角色與事蹟，也可以在「我」頁面刪除帳號，所有資料會一併刪除。</p>
    </article>
  );
}

export function TermsPage() {
  return (
    <article className="panel stack" style={{ maxWidth: 760, margin: "0 auto" }}>
      <h1>服務條款</h1>
      <Draft />
      <ul>
        <li>龍角鎮的事蹟必須是真人的真實經驗。請不要捏造事蹟，或讓 AI 捏造。</li>
        <li>請尊重其他鎮民；違反社群規範的內容會被過濾或移除。</li>
        <li>提供者提供的試用機會不得在試用後強迫推銷或綁約。</li>
        <li>龍角鎮不是醫療或心理諮商服務。如果你正處於危機中，請聯絡當地緊急服務或心理支持專線（台灣：1925 安心專線）。</li>
        <li>標示「示範」的內容是範例，不是真人。</li>
      </ul>
    </article>
  );
}
