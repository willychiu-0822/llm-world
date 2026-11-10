# 龍角鎮雲端部署

這份文件給還沒綁定雲端帳號的擁有者。目標是一條穩定的公開 HTTPS，取代會回 530／502 的 cloudflared quick tunnel。

程式已經做成單一容器：網頁、API、MCP、OAuth 都在同一個程序裡。容器啟動時會用 Postgres advisory lock 跑 migration，多個執行個體同時啟動也只會套用一次。所有設定都是環境變數，**沒有任何秘密寫進 git**。

標價以 2026-11-10 各平台公開頁為準（Render、Railway、Google Cloud Run、Neon）。按下建立之前，再對一次畫面上的金額。

## 先選平台

微型、幾乎沒有流量、但要一直開著（Google 登入與 MCP 不能靠會睡著的免費層）。

| | Render（建議） | Railway | Cloud Run + Neon |
|---|---|---|---|
| 微型站一個月大概多少 | 工作區 Hobby 0 元。網頁 `0.5c-512mb` 約 7 美元。Postgres `0.1c-256mb` 約 6 美元。本 repo 的 Blueprint 把磁碟設成 1 GB。合計大約 13 美元，金額固定 | Hobby 訂閱 5 美元，內含 5 美元用量。安靜的小站加小資料庫常常落在 5–15 美元；CPU／記憶體用多了就超過 | Cloud Run 在免費額度內可以是 0 元（request-based、us-central1：每月 200 萬次請求、18 萬 vCPU 秒、36 萬 GiB 秒）。Neon 免費方案 0 元。超過才計費。GCP 新帳號另有試用額度，但要綁定付款方式 |
| Postgres | 同一個 Render 帳號裡的 Postgres 17。免費資料庫 30 天後會停用並刪除，所以 Blueprint 用最小的付費方案，資料會留著 | 同一個帳號加一個 Postgres 外掛。Hobby 的磁碟上限 5 GB | Neon 免費：每專案 1 GB、每月 100 CU-hours，閒置約 5 分鐘計算歸零。額度用完會暫停連線，不會刪資料 |
| HTTPS／自訂網域 | `*.onrender.com` 自動 HTTPS。自訂網域含在方案裡 | `*.up.railway.app` 自動 HTTPS。可加自訂網域 | `*.run.app` 自動 HTTPS。自訂網域要另外在 Cloud Run 綁定 |
| OAuth 需要的網址 | 沒設 `BASE_URL` 時，程式改讀 Render 注入的 `RENDER_EXTERNAL_URL`。換自訂網域才要自己填 `BASE_URL` | 沒設 `BASE_URL` 時，程式用 `https://` 加上 `RAILWAY_PUBLIC_DOMAIN`。換自訂網域才要填 `BASE_URL` | 平台不會告訴程式公開網址。**一定要自己設 `BASE_URL`**，而且要和瀏覽器上的網址完全一致 |
| 為什麼這樣排 | 一個 Blueprint 同時建立網站和資料庫，秘密在畫面上詢問，不進 git。網站不休眠，資料庫不會 30 天後消失 | 可能更便宜，但帳單隨用量變動，要自己加資料庫、自己產生 `SESSION_SECRET` | 最有機會 0 元，可是要兩個帳號，冷啟動會讓第一次 Google 登入和 MCP 連線變慢。現有的 `deploy/gcp` 腳本是對 Cloud SQL，不是這條 Neon 路徑 |

沒有把 Fly.io 放進表裡：最小的應用機器大約 2 美元，但它的 Managed Postgres 最低方案是每月 38 美元，不適合這個微型站。

**建議用 Render。** 擁有者只要註冊、連上 GitHub、套用 repo 根目錄的 `render.yaml`。Google 登入仍然要一組 OAuth 用戶端，這三個平台都一樣。

免費、會休眠的網頁（Render 的 `free`）可以改，但閒置後第一個請求要等冷啟動，登入和 MCP 會不穩。這正是現在 tunnel 要換掉的原因，所以 Blueprint 用一直開著的 `0.5c-512mb`。

## 擁有者要準備的帳號與秘密

只列名稱。值由擁有者自己產生、自己貼到平台，不要貼進聊天、不要提交 git。

### 帳號

- `Render`：用 GitHub 登入即可。付費方案要可付款的帳單。
- `Google`：只拿來建立 OAuth 用戶端（Google Cloud Console 的用戶端），不是拿來跑主機。

### 他必須自己貼上的環境變數

Blueprint 會在建立時詢問這三個（`sync: false`）：

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `ADMIN_EMAILS`

使用 `*.onrender.com` 預設網址時，**不要**設定 `BASE_URL`。換自訂網域時才設定：

- `BASE_URL`

### 平台會自己填、他不必發明的名稱

- `DATABASE_URL`：Blueprint 從 `longjiao-db` 注入內部連線字串
- `SESSION_SECRET`：Blueprint 用 `generateValue` 產生，長度足夠
- `RENDER_EXTERNAL_URL`：Render 注入，程式拿來當公開網址

### 不要在正式環境打開

- `AUTH_DEV_LOGIN`：Blueprint 已設為 `false`。就算設成 `true`，`NODE_ENV=production` 也會忽略它

### 若改選 Railway 或 Cloud Run + Neon，他還要另外提供

- `DATABASE_URL`
- `SESSION_SECRET`（至少 32 字元的隨機字串）
- `BASE_URL`（Cloud Run 一定要；Railway 只有改自訂網域時才要）

可選、不設就用預設值：`MODERATION_MODE`（預設 `filter`）、`MODERATION_WORDS`、`MCP_RATE_LIMIT_PER_MINUTE`（預設 60）、`DB_POOL_MAX`（預設 5）、`SKIP_MIGRATIONS`（預設不跳過）。

## Render：套用 Blueprint

先做 Google 用戶端會缺重新導向網址，所以順序是：先讓網站上線，再填真正的 Google 秘密。建立當下那三個欄位可以先貼占位（用戶端還沒有就先填 `placeholder`，Email 填自己的），上線後立刻換成真的。

1. 註冊 [Render](https://render.com)，用 GitHub 登入，並讓這個 repo 授權給 Render。帳單要能付最小的網頁和 Postgres。
2. Dashboard → **New** → **Blueprint**。選這個 repo，以及含有 `render.yaml` 的分支。Render 讀的是 repo 根目錄的 `render.yaml`。
3. 畫面上會問 `GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET`、`ADMIN_EMAILS`。還沒有 Google 用戶端就先填占位和自己的 Email。不要在這裡自己填 `DATABASE_URL` 或 `SESSION_SECRET`。
4. 確認兩項都是 `singapore`（網頁 `longjiao`、資料庫 `longjiao-db`），Postgres 主要版本是 17，資料庫方案不是會在 30 天後刪除的 `free`。看清楚預估金額再建立。
5. 等第一個部署變成 Live。打開 `https://<服務名稱>.onrender.com/healthz`，應為 `{"ok":true}`。首頁應能打開。`/api/config` 的 `devLogin` 應為 `false`。
6. 到 [Google Cloud Console](https://console.cloud.google.com/) → API 和服務 → 憑證 → 建立 OAuth 用戶端（應用程式類型：網頁應用程式）。已授權的重新導向 URI 填：

   `https://<服務名稱>.onrender.com/auth/google/callback`

   同意畫面的首頁填同一個網址，隱私權政策填 `https://<服務名稱>.onrender.com/privacy`，服務條款填 `https://<服務名稱>.onrender.com/terms`。

7. 回到 Render → 服務 `longjiao` → Environment，把 `GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET` 換成上一步的值，`ADMIN_EMAILS` 設成管理者的 Email（逗號分隔，小寫即可）。儲存後 Render 會重啟。不要設 `BASE_URL`，除非你要換網域。
8. 用瀏覽器打開網站，走一次 Google 登入，應回到地圖。用 `ADMIN_EMAILS` 裡的帳號登入後，從「我」進得了管理頁。
9. 「連接 AI」頁的 MCP 網址應是 `https://<服務名稱>.onrender.com/mcp`。AI 用戶端新增自訂連接器後，會跳出龍角鎮的同意頁。

之後 git 上這個分支有新的 commit，Render 會自動重新部署。秘密留在 Render，不會跟著 commit 走。

資料庫只允許 Render 內網（`ipAllowList` 是空的）。筆電連不進去是預期的。migration 在網站程序啟動時跑，不需要另外開一個連線。

### 自訂網域

1. Render → 服務 → Settings → Custom Domains，依畫面把 DNS 指過去，等到 HTTPS 憑證完成。
2. Environment 新增 `BASE_URL`，值是 `https://你的網域`，結尾不要斜線。儲存並等重啟。
3. 把 Google 重新導向 URI、首頁、隱私權政策、服務條款改成新網址。舊的 `onrender.com` 回呼可以留著到你確認新網址能登入再刪。
4. 再看一次 `/api/config` 的 `mcpUrl`，必須是新的 `BASE_URL` 加上 `/mcp`。

### 本機先確認容器

不需要雲端帳號：

```bash
docker compose up --build
```

然後：

```bash
curl -fsS http://localhost:8080/healthz
```

瀏覽器打開 http://localhost:8080 。這是正式模式，沒有「開發用登入」。要那個按鈕時才疊開發檔（不要對公開網址這樣做）：

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

## 若改選 Railway

1. 註冊 Railway（Hobby），安裝 CLI 並 `railway login`。
2. 在專案裡新增 PostgreSQL。
3. 服務用這個 repo 的 Dockerfile。`railway.toml` 沒有另寫；Railway 會直接建 Dockerfile，健康檢查路徑用 `/healthz`。
4. 變數至少設定：`NODE_ENV=production`、`DATABASE_URL`（引用 Postgres 外掛的連線字串）、`SESSION_SECRET`（自己產生、至少 32 字元）、`GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET`、`ADMIN_EMAILS`、`AUTH_DEV_LOGIN=false`。
5. 部署：`railway up`。公開網址出來之後，Google 重新導向 URI 用 `https://<RAILWAY_PUBLIC_DOMAIN>/auth/google/callback`。沒改自訂網域就不要設 `BASE_URL`。

## 若改選 Cloud Run + Neon

這條不用 `deploy/gcp`（那些腳本會建立 Cloud SQL 和 Secret Manager）。用同一個 Dockerfile 即可。

1. 註冊 Neon，建立 Postgres 專案，複製連線字串，那就是 `DATABASE_URL`。
2. GCP 專案開啟 Cloud Run API，並綁定帳單。
3. 自己產生 `SESSION_SECRET`。`BASE_URL` 先留到第一次部署結束、`*.run.app` 網址出現後再設上，然後重新部署一次。Google 重新導向 URI 是 `<BASE_URL>/auth/google/callback`。
4. 部署容器時設定 `NODE_ENV=production`，並帶上 `DATABASE_URL`、`BASE_URL`、`SESSION_SECRET`、`GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET`、`ADMIN_EMAILS`。不要設 `AUTH_DEV_LOGIN`。
5. 端口用平台給的 `PORT`（程式會聽 `PORT`，預設 8080）。健康檢查路徑 `/healthz`。

Cloud Run 冷啟動加上 Neon 閒置歸零時，第一個請求會比較慢。流量起來之後再考慮 Neon 的付費方案，或把最小執行個體設成 1（就不再是 0 元）。

## 部署後必查

| 檢查 | 預期 |
|---|---|
| `GET /healthz` | `{"ok":true}` |
| `GET /api/config` | `devLogin` 是 `false`；有貼 Google 用戶端時 `googleLogin` 是 `true`；`mcpUrl` 等於公開網址加 `/mcp` |
| `GET /.well-known/oauth-authorization-server` | `issuer` 是公開網址加 `/` |
| 首頁 | 看得到龍角鎮 |
| Google 登入 | 回到地圖。`redirect_uri_mismatch` 代表重新導向 URI 和 `BASE_URL` 不一致 |

`SESSION_SECRET` 一旦換掉，舊的登入 cookie 會全部失效，這是預期的。資料庫 migration 只做新增（加表、加欄位），不要在同一次部署裡刪欄位，這樣才能把程式退回上一版而資料庫仍然相容。
