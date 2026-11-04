# 部署文件

> 先完成 [CLOUD-SETUP.md](./CLOUD-SETUP.md) 的資源準備。以下指令都可以在 Cloud Shell 的 repo 根目錄執行。

## 1. 部署架構

```
                    ┌──────────────── Cloud Run：longjiao（asia-east1）────────────────┐
瀏覽器 ───HTTPS───▶ │  /            網頁（React 靜態檔）                              │
AI 用戶端 ─MCP────▶ │  /mcp         MCP 伺服器（Bearer token）                        │
                    │  /authorize /token /register /.well-known/*   OAuth 2.1         │
                    │  /api /auth   REST API、Google 登入                             │
                    └───────────────┬────────────────────────────────────────────────┘
                                    │ Unix socket（/cloudsql/...）
                           Cloud SQL：PostgreSQL 16
```

- **單一容器**：網頁、API、MCP 共用同一組登入與資料，部署和維護最簡單。
- **映像內容**：只有 Node.js、打包好的伺服器（不含 `node_modules`）、SQL migration、網頁靜態檔。
- **啟動時自動 migration**：使用 Postgres advisory lock，多個執行個體同時啟動也只會執行一次。

## 2. 設定（環境變數與秘密）

| 名稱 | 必填 | 來源 | 說明 |
|---|---|---|---|
| `NODE_ENV` | 是 | 環境變數 | 固定 `production`；開發用登入在 production 一律關閉 |
| `BASE_URL` | 是 | 環境變數 | 服務的公開網址，例如 `https://longjiao-xxxx.asia-east1.run.app`。**OAuth、MCP、Google 登入都依賴它，必須和實際網址完全一致** |
| `DATABASE_URL` | 是 | 秘密 `longjiao-database-url` | Cloud SQL 連線字串 |
| `SESSION_SECRET` | 是 | 秘密 `longjiao-session-secret` | 至少 32 字元 |
| `GOOGLE_CLIENT_ID` | 是 | 環境變數 | OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | 是 | 秘密 `longjiao-google-client-secret` | OAuth Client secret |
| `ADMIN_EMAILS` | 建議 | 環境變數 | 管理者 Email，逗號分隔；登入時自動取得管理者權限 |
| `MODERATION_MODE` | 否 | 環境變數 | `off` / `log` / `filter`（預設）/ `block` |
| `MODERATION_WORDS` | 否 | 環境變數 | 額外的過濾關鍵字，逗號分隔 |
| `MCP_RATE_LIMIT_PER_MINUTE` | 否 | 環境變數 | 每個 AI 用戶端每分鐘的工具呼叫上限，預設 60 |
| `DB_POOL_MAX` | 否 | 環境變數 | 每個執行個體的資料庫連線數，預設 5 |
| `SKIP_MIGRATIONS` | 否 | 環境變數 | `true` 時啟動不跑 migration（改用 `jobs.sh migrate`） |

**為什麼密碼類放 Secret Manager**：環境變數會出現在 Cloud Run 的設定頁與部署紀錄裡，秘密則有獨立的存取權限與版本紀錄。

## 3. 第一次部署（網址要部署兩次）

Cloud Run 的 `*.run.app` 網址在第一次部署後才會產生，但 `BASE_URL` 和 Google 的重新導向 URI 都需要這個網址，所以分成兩次。

### 第 1 次：取得網址

```bash
PROJECT_ID=<你的專案ID> ADMIN_EMAILS=<你的Email> bash deploy/gcp/deploy.sh
```

- 腳本會用 Cloud Build 建置映像、推到 Artifact Registry、部署 Cloud Run。
- 這次 `BASE_URL` 是暫時值，結尾會印出實際網址，例如 `https://longjiao-abc123-de.a.run.app`。

### 設定 Google OAuth

1. 到 OAuth client 的「已授權的重新導向 URI」加入：`<網址>/auth/google/callback`
2. 到同意畫面補上首頁、隱私權政策（`<網址>/privacy`）、服務條款（`<網址>/terms`）

### 第 2 次：用正確網址部署

```bash
PROJECT_ID=<你的專案ID> BASE_URL=<網址> GOOGLE_CLIENT_ID=<Client ID> ADMIN_EMAILS=<你的Email> SKIP_BUILD=true bash deploy/gcp/deploy.sh
```

`SKIP_BUILD=true` 會沿用剛剛建好的映像，不重新建置。

### 驗證

| 檢查 | 怎麼做 | 預期 |
|---|---|---|
| 健康檢查 | `curl <網址>/healthz` | `{"ok":true}` |
| 設定 | `curl <網址>/api/config` | `devLogin` 為 `false`、`googleLogin` 為 `true`、`mcpUrl` 是 `<網址>/mcp` |
| OAuth 中繼資料 | `curl <網址>/.well-known/oauth-authorization-server` | `issuer` 是 `<網址>/` |
| 登入 | 瀏覽器打開網址 → 進入小鎮 → Google 登入 | 回到地圖，右上出現「我」 |
| 管理者 | 用 `ADMIN_EMAILS` 裡的帳號登入 → 我 → 管理 | 看得到管理頁 |
| 連接 AI | 「連接 AI」頁複製 MCP 網址，在 AI 用戶端新增自訂連接器 | 跳出龍角鎮登入與同意頁，同意後 AI 能呼叫 `character_get` |

## 4. 示範內容

正式環境上線時可以放入**明確標示「示範」**的內容（3 個示範提供者、9 個主題區各有示範事蹟）：

```bash
PROJECT_ID=<你的專案ID> bash deploy/gcp/jobs.sh seed-demo
```

清除示範內容（也可以在網頁「管理」頁按「清除所有示範內容」）：

```bash
PROJECT_ID=<你的專案ID> bash deploy/gcp/jobs.sh purge-demo
```

- 示範內容排在真人內容之後，不會觸發回謝。
- 清除時，真人在示範店留下的事蹟會保留，並移到該主題區的公共地點。

## 5. 之後的部署

### 方式 A：GitHub Actions（設定一次，之後自動）

完成 CLOUD-SETUP 第 5 節後，流程是：

```
開 PR → CI（型別檢查、單元／整合測試、建置、E2E）→ merge 到 main → CI 再跑一次 → 自動部署
```

也可以在 GitHub → Actions → Deploy → Run workflow 手動觸發。部署會沿用目前服務的網址作為 `BASE_URL`。

### 方式 B：手動

```bash
PROJECT_ID=<你的專案ID> GOOGLE_CLIENT_ID=<Client ID> ADMIN_EMAILS=<你的Email> bash deploy/gcp/deploy.sh
```

沒有給 `BASE_URL` 時，腳本會自動沿用服務目前的網址。

## 6. 資料庫 migration

- **預設**：服務啟動時自動執行，以 advisory lock 保證只跑一次。
- **手動**（例如想在部署前先跑）：

```bash
PROJECT_ID=<你的專案ID> bash deploy/gcp/jobs.sh migrate
```

- **新增 migration**（開發時）：修改 `packages/db/src/schema.ts` 後執行 `pnpm db:generate`，把 `packages/db/migrations/` 的新檔案一起提交。
- **原則**：只做「新增」型變更（加表、加欄位、加預設值），避免在同一次部署中刪除或改名欄位，這樣回滾到舊版本時資料庫仍然相容。

## 7. 回滾

列出版本：

```bash
gcloud run revisions list --service longjiao --region asia-east1
```

把流量切回某個舊版本：

```bash
gcloud run services update-traffic longjiao --region asia-east1 --to-revisions <舊版本名稱>=100
```

- 回滾只切換程式版本，**不會回滾資料庫**。所以 migration 要遵守第 6 節的「只新增」原則。
- 資料庫需要還原時，使用 Cloud SQL 每日備份（Console → SQL → 備份），或啟用時間點復原。

## 8. 日誌與監控

讀取最近的日誌：

```bash
gcloud run services logs read longjiao --region asia-east1 --limit 100
```

- Cloud Console → Cloud Run → longjiao → 「日誌」與「指標」可以看請求數、延遲、錯誤率、執行個體數。
- 產品層面的健康指標（主閉環各步驟的數量、AI／本人執行比例、真人與示範事蹟數、隨筆分享數）在網頁「管理」頁。

## 9. 擴充與成本調整

| 情況 | 調整 |
|---|---|
| 第一個請求偏慢（冷啟動） | `MIN_INSTANCES=1 bash deploy/gcp/deploy.sh`，會多一筆常駐費用 |
| 流量變大 | 提高 `MAX_INSTANCES`；注意總連線數約為 `MAX_INSTANCES × DB_POOL_MAX`，不要超過 Cloud SQL 上限（db-f1-micro 約 25） |
| 資料庫吃緊 | `gcloud sql instances patch longjiao-pg --tier db-g1-small`（會短暫重啟） |
| 想用自己的網域 | Cloud Run →「管理自訂網域」，然後用新網址更新 `BASE_URL` 與 Google 重新導向 URI |

## 10. 本機開發

用 Docker（最簡單）：

```bash
docker compose up --build
```

然後打開 http://localhost:8080，用登入頁的「開發用登入」。

不用 Docker：

```bash
pnpm install
```

```bash
cp .env.example .env
```

```bash
pnpm db:migrate && pnpm seed:demo
```

```bash
pnpm --filter @lj/web build && pnpm dev
```

測試：

```bash
pnpm test
```

```bash
pnpm test:e2e
```

單元／整合測試需要 `TEST_DATABASE_URL`（預設 `postgres://postgres:postgres@localhost:5432/longjiao_test`），E2E 使用 `longjiao_e2e`，每次執行前會自動清空。

## 11. 疑難排解

| 症狀 | 可能原因 | 處理 |
|---|---|---|
| Google 登入出現 `redirect_uri_mismatch` | 重新導向 URI 沒加，或和 `BASE_URL` 不一致 | 確認 OAuth client 有 `<BASE_URL>/auth/google/callback`，大小寫、結尾斜線都要一致 |
| AI 用戶端連接失敗、說找不到授權伺服器 | `BASE_URL` 不是實際網址 | 用正確 `BASE_URL` 重新部署；檢查 `/.well-known/oauth-authorization-server` 的 `issuer` |
| 服務啟動失敗：`SESSION_SECRET must be at least 32 characters` | 秘密沒設或太短 | 重新執行 `setup.sh`，或手動新增秘密版本 |
| 啟動時連不上資料庫 | 沒有 `--add-cloudsql-instances`，或服務帳戶缺 `cloudsql.client` | 用 `deploy.sh` 部署；確認 `setup.sh` 的 IAM 步驟成功 |
| `gcloud builds submit` 權限錯誤 | Cloud Build 使用的服務帳戶沒有推送映像的權限 | 給該帳戶 `roles/artifactregistry.writer`；或在本機 `docker build` 後 `docker push`，再用 `SKIP_BUILD=true TAG=<標籤>` 部署 |
| 同意畫面顯示「這個應用程式未經驗證」 | 應用程式在測試模式 | 正常現象；測試使用者可以繼續。正式開放請完成 CLOUD-SETUP 4.1 的發布 |
| 有人無法登入 | 測試模式只允許測試使用者 | 把對方加到測試使用者，或發布應用程式 |
