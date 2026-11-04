# Protocol（v1）

## 1. MCP 接入

| 項目 | 值 |
|---|---|
| 端點 | `https://<domain>/mcp`（Streamable HTTP） |
| 授權 | OAuth 2.1：`/.well-known/oauth-protected-resource`、`/.well-known/oauth-authorization-server`、動態用戶端註冊、Authorization Code + PKCE |
| 登入 | 授權頁使用 Google 登入，用戶同意後發給 AI 用戶端權杖 |
| Scope | `world` |

## 2. MCP 提示詞（Prompts）

| 名稱 | 用途 |
|---|---|
| `be_my_character` | 讓 AI 以用戶的角色身分行動：讀取角色設定、想做的事，說明世界的規則（不捏造事蹟、只帶回真實內容） |

## 3. MCP 工具（Tools）

| 工具 | 對應步驟 | 說明 |
|---|---|---|
| `character_get` | ① | 取得角色設定、想做的事、近期狀態 |
| `world_discover` | ② | 依想做的事取得策展候選（事蹟、試用機會、地點），附來源與執行者 |
| `place_get` | ② | 取得地點的事蹟與試用機會 |
| `deed_get` | ② | 取得事蹟詳情（含前人的第一步、選擇分享的隨筆） |
| `trial_get` | ② | 取得試用機會的過程資訊、問答、場次 |
| `provider_ask` | ⑥ | 向提供者提問：先比對常見問答，沒有答案就轉為提供者的待答問題 |
| `discovery_bring_back` | ② → ③ | 把挑選後的項目與一段話存進用戶的發現匣 |
| `first_step_propose` | ⑤ | 建議一個第一步（狀態為 `draft`，需用戶在 Web 確認） |
| `first_step_list` | ⑥ | 列出用戶已確認、由 AI 執行的待辦步驟 |
| `first_step_complete` | ⑥ → ⑧ | 回報 AI 步驟的執行結果，產生事蹟（執行者：AI） |

所有工具輸入以 zod 驗證；公開文字經過內容過濾。

## 4. REST API（Web 使用）

以 `/api` 為前綴，session cookie 驗證。主要資源：

| 資源 | 操作 |
|---|---|
| `/me`、`/me/character`、`/me/wants` | 角色與想做的事 |
| `/discoveries` | 發現匣 |
| `/places`、`/places/:id` | 地點與地圖資料 |
| `/deeds/:id` | 事蹟 |
| `/first-steps` | 定義、確認、完成、放棄 |
| `/first-steps/:id/notes` | 做前 / 做後隨筆與分享設定 |
| `/bookings`、`/sessions/:id/ics` | 報名與行事曆檔 |
| `/mirror` | 成就鏡子 |
| `/notifications` | 通知 |
| `/provider/*` | 提供者後台：試用機會、場次、出席確認、問題、需求訊號、回謝 |
| `/admin/*` | 提供者核准、內容過濾紀錄 |

## 5. 錯誤碼

| code | 說明 |
|---|---|
| `invalid_input` | 輸入格式錯誤 |
| `not_found` | 資源不存在或無權限 |
| `forbidden` | 角色權限不足 |
| `moderation_blocked` | 內容被過濾（`block` 模式） |
| `rate_limited` | 超過速率限制 |
| `step_not_confirmed` | 第一步尚未經用戶確認 |
