# Architecture（v1）

> 範圍與決策見 [MVP-PLAN.md](./MVP-PLAN.md)；概念見 [CORE-LOOP.md](./CORE-LOOP.md)。

## 1. 系統概觀

```
 [用戶的 AI 用戶端]                 [用戶 / 提供者 / 管理者的瀏覽器]
 Claude · ChatGPT · Grok · Cursor            │
        │ MCP (Streamable HTTP)              │ HTTPS
        │ + OAuth 2.1                        │
        ▼                                    ▼
 ┌───────────────────── Cloud Run（單一服務）──────────────────────┐
 │  /mcp            MCP 伺服器（工具、提示詞）                       │
 │  /oauth, /.well-known   OAuth 2.1 授權伺服器（DCR + PKCE）        │
 │  /api            REST API（Web 使用）                            │
 │  /               Web 靜態檔（React SPA）                         │
 │                                                                 │
 │  Domain 層：角色 · 想做的事 · 發現 · 地點 · 事蹟 · 第一步 · 隨筆     │
 │             試用機會 · 場次 · 報名 · 問答 · 通知 · 內容過濾         │
 └──────────────────────────────┬──────────────────────────────────┘
                                │
                     Cloud SQL（PostgreSQL 16）
```

**平台本身不呼叫任何 LLM。** 所有 AI 行為都發生在用戶自己的 AI 用戶端，透過 MCP 工具讀寫世界。

## 2. 技術選型

| 層 | 選擇 | 理由 |
|---|---|---|
| 語言 | TypeScript（Node.js 22） | 前後端同語言，型別共用 |
| 套件管理 | pnpm workspaces | monorepo |
| HTTP | Express | 可直接使用 MCP SDK 的 OAuth 路由輔助 |
| MCP | `@modelcontextprotocol/sdk`（Streamable HTTP transport） | 官方 SDK |
| 資料庫 | PostgreSQL 16 + Drizzle ORM | 型別安全、migration 簡單 |
| 驗證（人） | Google OAuth（OpenID Connect）+ HttpOnly session cookie | |
| 驗證（AI） | 自建 OAuth 2.1 授權伺服器：動態用戶端註冊、Authorization Code + PKCE、存取權杖 + 更新權杖 | 符合 MCP 授權規範，各家 AI 用戶端可直接連 |
| 前端 | React + Vite + React Router；地圖用 Leaflet + OpenStreetMap | 輕量、手機優先 |
| 驗證輸入 | zod（API 與 MCP 工具共用 schema） | |
| 測試 | Vitest（單元、整合，資料庫用 PGlite 或測試用 Postgres）、Playwright（E2E） | |
| 部署 | Docker → Artifact Registry → Cloud Run | |

## 3. Repo 結構

```
apps/
  server/        Express：/api、/mcp、/oauth、靜態檔
  web/           React SPA（用戶、提供者、管理者）
packages/
  core/          Domain 邏輯、zod schema、策展、內容過濾
  db/            Drizzle schema、migration、種子資料
e2e/             Playwright 與 MCP 用戶端 E2E
docs/
```

## 4. 資料模型（概要）

| 表 | 重點欄位 |
|---|---|
| `users` | google_sub、email、display_name、roles（user / provider / admin） |
| `characters` | user_id、name、appearance（sprite、palette、description）、personality、sharing |
| `wants` | character_id、text、tags、status（active / done / dropped） |
| `places` | name、address、lat、lng、provider_id（可空）、tags |
| `deeds` | owner_id、character_id、executor（ai / self）、title、first_step_id、place_id、trial_id、related_deed_ids、record_source（provider_confirmed / self / ai）、visibility、moderation_state |
| `first_steps` | owner_id、want_id、executor（ai / self）、text、when、where、status（draft / confirmed / done / dropped）、source_deed_ids、session_id |
| `notes` | first_step_id、kind（before / after）、body、shared（預設 false） |
| `discoveries` | character_id、items（deed / trial / place 參考）、message（AI 寫的話）、read_at |
| `providers` | user_id、name、description、status（pending / approved / suspended） |
| `trials` | provider_id、place_id、title、duration、exit_anytime、buddy_ok、process_info、ai_first_step_hint、self_first_step_hint |
| `trial_faqs` | trial_id、question、answer |
| `trial_sessions` | trial_id、starts_at、capacity |
| `bookings` | session_id、user_id、first_step_id、attended_at |
| `provider_questions` | trial_id、asker_id、question、answer、answered_at |
| `follows` | from_deed_or_step、to_deed_id（回謝來源） |
| `notifications` | user_id、kind、payload、read_at |
| `oauth_clients` / `oauth_codes` / `oauth_tokens` | MCP OAuth |
| `moderation_log` | target、categories、action |

## 5. 策展檢索

伺服器只做規則式排序，最後的挑選與轉譯交給用戶的 AI：

```
score = 相關（想做的事的 tags / 文字比對）
      + 第一次加權（事蹟是該執行者在該主題的第一次）
      + 一步之遙（第一步越小、時長越短越高）
      + 新鮮度
      - 已看過
```

- 不接受付費影響排序。
- 文字比對使用 PostgreSQL 全文檢索與 `pg_trgm`（支援中文的 n-gram 比對）。

## 6. 內容過濾

`packages/core/moderation`：可插拔 provider 介面 `check(text, ctx) → { flagged, categories, spans }`；v1 內建關鍵字 provider。檢查範圍：角色公開欄位、想做的事、事蹟、分享的隨筆、提供者內容、問答。私人隨筆不檢查。

## 7. 安全

- MCP 權杖只授予該用戶自己的資料範圍；工具不能讀取他人的私人隨筆。
- AI 建立的第一步為 `draft`，需用戶在 Web 確認。
- 速率限制：每個 OAuth client 每分鐘的工具呼叫上限。
- 所有秘密放 Secret Manager，不進程式碼。
