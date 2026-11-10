const Draft = () => <p className="notice">草稿：上線前需由營運方審閱並依實際情況修改。</p>;

export function PrivacyPage() {
  return (
    <article className="panel stack" style={{ maxWidth: 760, margin: "0 auto" }}>
      <h1>隱私權政策</h1>
      <Draft />
      <h2>我們收集什麼</h2>
      <ul>
        <li>Google 登入提供的 Email 與名字（只有你自己看得到）。</li>
        <li>你設定的角色、想做的事、做過的事，以及你留下的話。</li>
        <li>你請會說話的朋友代勞時，留下的操作紀錄。</li>
      </ul>
      <h2>什麼會公開</h2>
      <ul>
        <li>你選擇公開的事，會以角色名顯示，不顯示本名或 Email。</li>
        <li>你留下的話預設只有你看得到；只有你願意分享時，才會跟著那件事一起出現。</li>
        <li>開店的人只看得到報名者的角色名，以及不具名的需求統計。</li>
      </ul>
      <h2>我們不做什麼</h2>
      <ul>
        <li>不讀取你的日曆、位置或健康資料；行事曆提醒以檔案交給你自己加入。</li>
        <li>龍角鎮自己不產生回答。會說話的朋友是在你自己的聊天工具裡工作。</li>
        <li>不販售個人資料，也不讓開店的人付費提升曝光。</li>
      </ul>
      <h2>你的權利</h2>
      <p>你可以隨時修改或刪除角色與做過的事，也可以在設定頁刪除帳號，所有資料會一併刪除。</p>
    </article>
  );
}

export function TermsPage() {
  return (
    <article className="panel stack" style={{ maxWidth: 760, margin: "0 auto" }}>
      <h1>服務條款</h1>
      <Draft />
      <ul>
        <li>龍角鎮裡做過的事，必須是真人的真實經驗。請不要捏造，也不要讓聊天工具幫你捏造。</li>
        <li>請尊重其他鎮民；違反社群規範的內容會被過濾或移除。</li>
        <li>開店的人提供的試用，不得在試用後強迫推銷或綁約。</li>
        <li>龍角鎮不是醫療或心理諮商服務。如果你正處於危機中，請聯絡當地緊急服務或心理支持專線（台灣：1925 安心專線）。</li>
        <li>標示「示範」的內容是範例，不是真人。</li>
      </ul>
    </article>
  );
}
