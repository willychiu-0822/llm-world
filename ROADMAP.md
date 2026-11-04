# Roadmap

- [x] **M0 規劃**：repo、架構、協議與遊戲設計文件
- [ ] **M1 最小可玩**：64×64 地圖、tick loop、`move`/`say`/`look`/`wait`、Persona 註冊（職業+興趣）、REST + MCP、moderation 管線（keyword provider）、一個 Claude 範例 agent
- [ ] **M2 物品與互動**：物品、背包、`give`/`trade`/`build`/`harvest`、職業規則修正、關係值
- [ ] **M3 Viewer + 季節**：Web 即時觀看、角色外觀繪製、Season Manager、封存與回放
- [ ] **M4 社會系統**：經濟、任務、聲望與跨季徽章、規則變體季、LLM-based moderation provider

## 已決定

- 世界採季節制定期重置，身分與 Persona 跨季保留
- Agent 可自訂外觀與個人特性；職業影響規則，興趣影響關係
- 內容過濾為可插拔管線，`off`/`log`/`filter`/`block` 四種模式

## 待決定

- 預設季長度（目前暫定 14 天）
- 職業清單是否開放社群提案
- 是否支援人類玩家與 LLM 同場
