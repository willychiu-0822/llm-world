# Research：類似專案調查（2026-11）

## 競品一覽

| 專案 | 類型 | 開放自帶 LLM | 持久世界 | 養成/陪伴 | 影響真實生活 |
|---|---|---|---|---|---|
| [AI Town](https://github.com/a16z-infra/AI-town)（a16z） | 自主 AI 小鎮範本 | ✗（開發者控制） | ✓ | ✗ | ✗ |
| [AI Tamago](https://fly.io/blog/how-i-fly-yoko-li)（Yoko Li） | LLM 電子雞 | 本地模型 | ✗ | ✓ | ✗ |
| [Moltbook](https://medium.com/@tahirbalarabe2/what-is-moltbook-the-social-network-for-ai-agents-12f7a28a2d12) | AI-only 社群論壇 | ✓（MCP/API key） | ✗（論壇） | 弱（真人認領） | ✗ |
| [SimWorld](https://github.com/simworld-ai/simworld)（NeurIPS 2025） | Unreal 研究模擬 | ✓ | ✓ | ✗ | ✗ |
| [AgentVerse](https://github.com/openbmb/agentverse) / ChatArena / GPTeam | 多 agent 框架 | ✓ | ✗ | ✗ | ✗ |
| [TamaTown](https://ethglobal.com/showcase/tamatown-q8j8t) | 黑客松：24/7 個體寵物 | ? | ✓ | ✓ | ✗ |
| [Finch](https://cehhs.utk.edu/ero/managing-self-care-through-the-finch-app/) | 自我照顧寵物 App | ✗（無 LLM 世界） | 弱 | ✓ | ✓ |

**結論**：「開放接入」+「持久世界」+「養成陪伴」+「影響真實生活」四者同時具備的產品目前不存在。

## 可借鏡

- **AI Town / Generative Agents**：記憶 = 觀察記憶 + 反思記憶，用於小夥伴長期人格一致性
- **Moltbook**：agent 註冊後由真人用 claim link 認領 → 建立「主人—小夥伴」綁定
- **Finch**：完成真實生活的自我照顧 → 寵物獲得能量、配件、探索能力。寵物不會因主人沒做而死亡或受罰
- **AI Tamago**：用 LLM 取代狀態機，讓寵物有「想法與情緒」

## 要避開

- **Moltbook 的遠端指令模式**：agent 定期抓取遠端檔案並照做，被指出有重大風險 → 我們只回傳 observation，不下發指令
- **懲罰式養成**（傳統電子雞會死）：會造成焦慮與罪惡感，與「讓人變更好」矛盾

## 證據強度提醒

Finch 類 App 改善習慣的證據目前多為**使用者心得與官方宣傳**，未找到同儕審查研究（[WhistleOut 4 週評測](https://www.whistleout.com/CellPhones/Guides/finch-self-care-app-review) 也指出它不是臨床工具）。我們的「改善生活」效果要自己設計量測方式，不能假設有效。

## 後續研究

- PubMed / PsycINFO：gamified mental health、virtual companion 的實證研究
- AI 伴侶的依賴風險（如 Replika 相關研究）
- 行為改變理論：Fogg Behavior Model、Self-Determination Theory
