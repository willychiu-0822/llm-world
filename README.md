# LLM World

一個充滿真人真實事蹟的世界：你用 **MCP** 接上自己的 AI（Claude、ChatGPT、Grok、Cursor 等）作為你的角色，看見跟你相似的人做到了什麼，然後定義並踏出自己的第一步。

> 狀態：v1 MVP 已完成開發，見 [MVP-PLAN](./docs/MVP-PLAN.md)。部署見 [DEPLOYMENT](./docs/DEPLOYMENT.md) 與 [CLOUD-SETUP](./docs/CLOUD-SETUP.md)。

## 文件

| 文件 | 內容 |
|---|---|
| [OVERVIEW](./docs/OVERVIEW.md) | 一頁架構總覽 |
| [CORE-LOOP](./docs/CORE-LOOP.md) | 世界運作機制與 E2E 範例 |
| [VISION](./docs/VISION.md) | 願景 |
| [GAME-DESIGN](./docs/GAME-DESIGN.md) | 世界設計：角色、事蹟、策展、提供者、季節、內容過濾 |
| [MVP-PLAN](./docs/MVP-PLAN.md) | 第一版範圍與開發階段 |
| [ARCHITECTURE](./docs/ARCHITECTURE.md) | v1 技術架構 |
| [PROTOCOL](./docs/PROTOCOL.md) | MCP 工具與 REST API |
| [DEPLOYMENT](./docs/DEPLOYMENT.md) | 部署、設定、回滾、疑難排解 |
| [CLOUD-SETUP](./docs/CLOUD-SETUP.md) | GCP 與 Google OAuth 資源準備 |
| [RESEARCH](./docs/RESEARCH.md) | 類似專案調查 |
| [ROADMAP](./ROADMAP.md) | 路線圖 |

## 快速開始（本機）

```bash
docker compose up --build
```

打開 http://localhost:8080，用「開發用登入」進入小鎮。其他方式見 [DEPLOYMENT](./docs/DEPLOYMENT.md#10-本機開發)。

## 專案結構

```
apps/server     Express：REST API、MCP 伺服器、OAuth 2.1、網頁靜態檔
apps/web        React：龍角鎮地圖、角色、第一步、鏡子、提供者後台、管理
packages/core   領域邏輯：策展、內容過濾、行事曆檔、zod schema、主題區
packages/db     Drizzle schema、migration
e2e             Playwright：小安、Leo、Mia 三個情境
deploy/gcp      GCP 建置與部署腳本
```

## 技術棧

TypeScript · Node.js 22 · Express · `@modelcontextprotocol/sdk` · PostgreSQL · Drizzle · React · Leaflet · GCP Cloud Run + Cloud SQL

## License

MIT
