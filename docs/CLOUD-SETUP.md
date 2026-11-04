# 雲端資源準備（GCP）

> 本文件說明部署龍角鎮 v1 前，需要在 GCP 與 Google 帳號中準備哪些資源、為什麼需要、怎麼建立。
> 實際部署步驟見 [DEPLOYMENT.md](./DEPLOYMENT.md)。

## 0. 資源總覽

| 資源 | 用途 | 建立方式 | 約略月費* |
|---|---|---|---|
| GCP 專案 + 帳單帳戶 | 所有資源的容器與計費 | 手動（第 2 節） | — |
| Cloud Run 服務 `longjiao`（asia-east1） | 執行 API、MCP、網頁 | `deploy.sh` | 低流量時接近 0（最低執行個數 0） |
| Cloud SQL for PostgreSQL 16 `longjiao-pg` | 資料庫 | `setup.sh` | db-f1-micro 約 US$9–12 + 10GB SSD 約 US$2 |
| Artifact Registry `longjiao` | 存放容器映像 | `setup.sh` | 每 GB 約 US$0.1 |
| Secret Manager（3 個秘密） | DB 連線字串、Session 金鑰、Google client secret | `setup.sh` | 幾乎免費 |
| 服務帳戶 `longjiao-run` | Cloud Run 執行身分（最小權限） | `setup.sh` | 免費 |
| Google OAuth client + 同意畫面 | 讓使用者用 Google 登入 | 手動（第 4 節） | 免費 |
| （選用）Workload Identity Federation + `longjiao-deployer` | GitHub Actions 免金鑰自動部署 | `github-wif.sh` | 免費 |
| （選用）預算警示 | 費用超出時通知 | 手動（第 6 節） | 免費 |

\* 價格會變動，請以 [Cloud Run](https://cloud.google.com/run/pricing) 與 [Cloud SQL](https://cloud.google.com/sql/pricing) 官方定價為準。

**為什麼這樣選**：Cloud Run 沒有流量時不收費，適合早期驗證；資料庫是唯一的固定成本。之後流量變大，只要調整規格，不用換架構。

## 1. 你需要準備的東西

| 項目 | 說明 |
|---|---|
| Google 帳號 | 擁有建立 GCP 專案與帳單的權限 |
| 帳單帳戶 | 綁定信用卡；新帳號通常有免費試用額度 |
| `gcloud` CLI | 本機安裝，或直接使用瀏覽器裡的 [Cloud Shell](https://shell.cloud.google.com)（已內建 gcloud 與 git，最省事） |
| 這個 repo | 在 Cloud Shell 執行 `git clone https://github.com/willychiu-0822/llm-world` |
| 管理者 Email | 寫進 `ADMIN_EMAILS`，第一位管理者用來核准提供者 |

## 2. 建立 GCP 專案與帳單

1. 到 [Google Cloud Console](https://console.cloud.google.com/projectcreate) 建立專案，例如 `longjiao-town`。記下**專案 ID**（不一定等於名稱）。
2. 到「帳單」把專案連結到帳單帳戶。
   - **為什麼**：Cloud SQL、Cloud Build 等服務沒有帳單無法啟用。
3. 在 Cloud Shell 設定專案：

```bash
gcloud config set project <你的專案ID>
```

## 3. 一次建立基礎資源（setup.sh）

```bash
PROJECT_ID=<你的專案ID> bash deploy/gcp/setup.sh
```

這個腳本可以重複執行，已存在的資源會略過。它會建立：

| 步驟 | 建立的東西 | 為什麼 |
|---|---|---|
| 啟用 API | Cloud Run、Cloud SQL Admin、Artifact Registry、Secret Manager、Cloud Build、IAM Credentials | 這些服務預設關閉 |
| Artifact Registry | `asia-east1` 的 Docker 倉庫 `longjiao` | 存放每次部署的映像，方便回滾 |
| Cloud SQL | PostgreSQL 16、Enterprise 版、`db-f1-micro`、10GB 自動擴充、每日備份 | 最小規格起步；Enterprise 版才支援共享核心的小規格 |
| 資料庫與使用者 | 資料庫 `longjiao`、使用者 `longjiao`（隨機強密碼） | 應用程式不使用 postgres 超級使用者 |
| 秘密 `longjiao-database-url` | `postgres://longjiao:<密碼>@localhost/longjiao?host=/cloudsql/<連線名稱>` | 透過 Cloud SQL 的 Unix socket 連線，不需開放公開 IP 給應用程式 |
| 秘密 `longjiao-session-secret` | 隨機 48 bytes | 簽署登入 session 與同意頁的防偽 token |
| 秘密 `longjiao-google-client-secret` | 先放 `pending` 佔位 | 第 4 節建立 OAuth client 後再填入 |
| 服務帳戶 `longjiao-run` | 角色：`cloudsql.client`、`secretmanager.secretAccessor`、`logging.logWriter` | 最小權限：只能連資料庫、讀秘密、寫日誌 |

> Cloud SQL 建立需要 5–10 分鐘，請耐心等候。

**這個做法還能用在哪**：「秘密放 Secret Manager、執行身分只給最小權限」是任何雲端服務的基本安全做法。

## 4. Google 登入（OAuth 同意畫面與 client）

龍角鎮的使用者用 Google 帳號登入。AI 用戶端（Claude、ChatGPT…）連接時，也會先導到這個登入頁。

### 4.1 同意畫面（OAuth consent screen）

到 [Google Auth Platform](https://console.cloud.google.com/auth/overview)（舊介面名稱為「OAuth 同意畫面」）：

| 欄位 | 填寫 |
|---|---|
| 應用程式名稱 | 龍角鎮 |
| 使用者支援 Email | 你的 Email |
| 目標對象 | 外部（External） |
| 範圍（Scopes） | `openid`、`email`、`profile`（都是不需審核的基本範圍） |
| 首頁 / 隱私權政策 / 服務條款 | `<BASE_URL>/`、`<BASE_URL>/privacy`、`<BASE_URL>/terms`（第一次部署後才有網址，可以之後再補） |
| 發布狀態 | 先維持「測試中」，並把要測試的人加到**測試使用者** |

- **測試模式的限制**：最多 100 位測試使用者，而且只有名單上的人能登入。正式開放給所有人前，需要按「發布應用程式」。只使用基本範圍時通常不需要完整審核，但 Google 可能要求驗證網域或品牌資訊。
- **網域注意事項**：`*.run.app` 不是你擁有的網域。測試模式通常可以使用；若發布時 Google 要求驗證網域，請改用自有網域（Cloud Run 支援對應自訂網域），並同步更新 `BASE_URL`。
- **隱私權政策與服務條款**：目前頁面是草稿，發布前請審閱 `apps/web/src/pages/Legal.tsx` 的內容。

### 4.2 OAuth client

到「用戶端（Clients）」→ 建立用戶端：

| 欄位 | 填寫 |
|---|---|
| 應用程式類型 | 網頁應用程式 |
| 名稱 | 龍角鎮 Web |
| 已授權的重新導向 URI | `<BASE_URL>/auth/google/callback`（第一次部署取得網址後再加入） |

建立後會得到 **Client ID** 和 **Client secret**：

- Client ID：部署時以環境變數 `GOOGLE_CLIENT_ID` 傳入（不是秘密）。
- Client secret：存進 Secret Manager，不要放進程式碼或 shell 歷史：

```bash
PROJECT_ID=<你的專案ID> bash deploy/gcp/add-google-secret.sh
```

## 5.（選用）GitHub Actions 自動部署

設定後，每次 merge 到 `main` 且 CI 通過，就會自動部署。使用 **Workload Identity Federation**：GitHub 用短效憑證換取 GCP 權限，不需要下載、保管任何服務帳戶金鑰。

```bash
PROJECT_ID=<你的專案ID> GITHUB_REPO=willychiu-0822/llm-world bash deploy/gcp/github-wif.sh
```

腳本會：

- 建立身分池 `github-pool` 與提供者 `github-provider`，**只信任這個 repo 的 `main` 分支**
- 建立部署帳戶 `longjiao-deployer`，角色：`run.admin`、`artifactregistry.writer`、`cloudbuild.builds.editor`、`storage.admin`、`serviceUsageConsumer`、`logging.viewer`，以及可以代表 `longjiao-run` 部署
- 印出要填到 GitHub 的變數

到 GitHub repo → Settings → Secrets and variables → Actions → **Variables**（不是 Secrets，這些值都不是機密）新增：

| 變數 | 值 |
|---|---|
| `GCP_PROJECT_ID` | 專案 ID |
| `GCP_REGION` | `asia-east1` |
| `GCP_WIF_PROVIDER` | 腳本印出的 provider 完整名稱 |
| `GCP_DEPLOY_SA` | `longjiao-deployer@<專案ID>.iam.gserviceaccount.com` |
| `GOOGLE_CLIENT_ID` | OAuth Client ID |
| `ADMIN_EMAILS` | 管理者 Email（逗號分隔） |

沒有設定 `GCP_PROJECT_ID` 時，部署工作流程會自動略過，不會失敗。

## 6.（建議）預算警示

到「帳單」→「預算與快訊」建立預算，例如每月 US$30，在 50%、90%、100% 時寄信。

- **為什麼**：Cloud Run 會自動擴充，萬一被濫用，預算警示能讓你第一時間知道。`deploy.sh` 也預設最多 3 個執行個體，限制最壞情況的費用。

## 7. 準備完成檢查清單

- [ ] GCP 專案已建立並連結帳單，記下專案 ID
- [ ] `setup.sh` 執行成功（Cloud SQL 狀態為 RUNNABLE）
- [ ] OAuth 同意畫面已設定，測試使用者已加入
- [ ] OAuth client 已建立；Client secret 已用 `add-google-secret.sh` 存入
- [ ] 決定管理者 Email（`ADMIN_EMAILS`）
- [ ]（選用）`github-wif.sh` 已執行，GitHub Variables 已設定
- [ ]（建議）預算警示已建立

完成後依 [DEPLOYMENT.md](./DEPLOYMENT.md) 進行第一次部署。
