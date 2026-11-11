# 龍角鎮生活世界驗收：未合格

2026-11-11 13:48（台北）。基底 `e6bc733`，分支 `codex/llmworld-living-world-1105`，工作樹未提交。依使用者門檻，未驗完按 FAIL；目前 P0 未全過，不宣稱達標。本檔在專案內：指定的 `/workspace/llm-world-uat/` 和 `/workspace/codex-burn/notes/` 不在執行環境可寫範圍。

最新程式 `pnpm typecheck`、`pnpm build`、`pnpm test`（25 檔 129 項）與 Chrome 全套 E2E（60/60）通過。完整輸出依序在 `/tmp/laned-decor-typecheck.log`、`/tmp/laned-decor-build.log`、`/tmp/laned-decor-unit.log`、`/tmp/laned-decor-full-e2e.log`。此前手機檢核曾遇瀏覽器 session 關閉，單獨重跑及最新全套通過，原因未確定，紀錄在 `/tmp/laned-button-green.log`、`/tmp/laned-button-mobile-retry.log`。

本輪新帳號獨立主線手機及桌機各 44 狀態，含訪客地圖→地點→信物、刷新、第 2 階舊頁和 MCP 401；原始結果與逐屏圖片在 `docs/uat/verify-codex/independent-after-decor/`。獨立生活旅程手機及桌機各 37 狀態，含七項活動、收藏、穿戴、未領養、預期 503 重試、空收藏與 Esc，見 `docs/uat/verify-codex/independent-life-final2/`。目視新手兩尺寸首屏、生活兩尺寸截圖及更新後穿戴；生活截圖的非佈置畫面與先前 `independent-life-final/` 逐張相同版型，後者已逐張檢視，另檢視這次兩張佈置家頁。未把腳本成功當成所有項目通過。

| 項 | 結果 | 證據／缺口 |
| --- | --- | --- |
| A1 | PASS | 各旅程 dialog 有明確動作與 X；信物、郵筒由「好」改為「收好信物」「關上郵筒」，E2E 斷言及 `mobile-15-cabinet-detail.png`。 |
| A2 | PASS | 兩尺寸主線無非按鈕 pointer；生活狀態官方 E2E 同檢。 |
| A3 | PASS | 兩尺寸主線及生活狀態可見 primary 均一個，原始 JSON 可核。 |
| A4 | PASS | 上述狀態量測按鈕與連結均 ≥44×44px。 |
| A5 | PASS | 新手登入、出門、接下、完成連點各一請求；七項生活活動的連點 E2E 每次一請求。 |
| A6 | FAIL | 提示條按鈕已改成「關閉提示」，但尚未獨立觸發各類提示逐一量測是否遮擋主操作或輸入。 |
| B1 | PASS | 家→出門→接下→完成三次操作，星星即時入帳。 |
| B2 | PASS | 慶祝的 X、Esc 保留星星回家；生活結果收好後日記／收藏更新。 |
| B3 | PASS | 主線、地圖支線、新生活頁有家與返回路徑；未登入／未領養狀態有引導。 |
| B4 | FAIL | 已驗孵化、信物、接下、地點支線及生活日記／收藏／穿戴刷新；未逐一驗所有頁與所有彈窗狀態。 |
| B5 | PASS | 主線與設定、收藏、信使用一致名稱；見主線截圖。 |
| C1 | PASS | 新手路徑及生活畫面官方禁詞掃描；第 2 階前連接頁受門禁保護。 |
| C2 | PASS | 主線與生活畫面禁用說教詞掃描及截圖閱讀。 |
| C3 | PASS | 旅程掃描錯字樣式與內部編號，人工複核。 |
| C4 | PASS | 目視主要遊戲文案輕鬆、句子短；連接進階說明較長。 |
| D1 | PASS | 兩尺寸截圖按鈕階層一致。 |
| D2 | PASS | 兩尺寸卡片、彈窗間距一致；以截圖判斷。 |
| D3 | PASS | 官方 checklist 對每個狀態執行 axe 色彩對比；獨立截圖未見溢出或重疊。 |
| D4 | FAIL | 尚未以瀏覽器量測各頁 CLS，不能僅憑靜態截圖判定。 |
| D5 | PASS | 桌機雙欄，手機畫面未水平溢出；見主線及生活兩尺寸截圖。 |
| E1 | PASS | 主線量測手機約 156px、桌機約 261px；點擊有回話。 |
| E2 | PASS | 星星、背包、階段及圍巾可見；生活圍巾和小燈另見 `independent-life-final2/*-decorated.png`。 |
| E3 | PASS | 信物九格 1/9、其餘灰色；生活收藏七格 0/7 與 7/7。 |
| E4 | PASS | 今日心願、可選幫忙與七種活動提供回訪內容。 |
| F1 | PASS | 獨立旅程無 console／pageerror／非預期 API 錯誤；503 是刻意注入以測重試。 |
| F2 | FAIL | 已驗 dialog 標題、aria-modal、Esc 與未取得物件焦點返回；尚未獨立走完所有畫面的鍵盤焦點順序。 |
| F3 | PASS | CSS reduced-motion、孵化刷新不重播；獨立 reduced-motion 與 E2E 證據。 |
| F4 | PASS | 最新 typecheck、129 單元、build、60 E2E 均通過。 |
| G1 | PASS | 今日片段與心願同日刷新穩定；單元測試跨台北日及 GET 不寫。 |
| G2 | PASS | 獨立雙尺寸完成七種活動，取消不寫、明確收好。 |
| G3 | PASS | DB 測試重複與設定並行、使用者隔離；獨立旅程刷新日記／收藏。 |
| G4 | PASS | 不活躍測試不扣物；七項活動後零星星且未寫真人事蹟。 |
| G5 | FAIL | 四季／時段與當季節慶已測；玩家同意相遇尚未實作。 |
| G6 | PASS | 七格、四類、來源日期、實際圍巾／小燈、收回及刷新有測試與圖片。 |
| G7 | PASS | 生活頁禁詞、每屏主按鈕、44px、dialog 與焦點回復有測。 |
| G8 | PASS | 未登入、未領養、503 重試、空收藏、返回兩尺寸測試。 |
| G9 | FAIL | 玩家明確同意串門與撤回後相遇尚未實作。 |
| G10 | FAIL | 生活頁即時公開經驗入口尚未實作。 |
| G11 | FAIL | 第 2 階門禁與 MCP 401 已測；`life_get` 尚未實作。 |
| G12 | FAIL | 完整 A–G P0 門檻未達，尚未完成後續功能及全套重驗。 |

修正清單：補 A6 真實提示遮擋與操作檢查、B4 全狀態刷新、F2 全流程鍵盤、D4 CLS；依 GDD 完成 G9–G11，再做完整雙尺寸新帳號驗收並重新計算。尚未 commit／push；不得視為交付完成。

後續：A6 已用 `e2e/toast-visibility.spec.ts` 實際觸發建立步驟的提示；修正前桌機通過、手機提示遮住「定義新的一步」而失敗（`/tmp/laned-toast.log`）。提示改為頁面內、明確按鈕關閉後，兩尺寸針對性測試通過（`/tmp/laned-toast-green.log`）。此次修改後原本完整測試與截圖需重跑，仍不可用上述舊結果宣稱本批合格。尚須驗證在長頁面捲動後提示仍能被看到並操作，以及 B4、F2 和 G9–G11。

2026-11-11 17:23 續驗：長頁完成後提示原先在頁首、在手機與桌機視窗外（`e2e/toast-scroll.spec.ts` 兩項重現）。提示出現時捲入視野，剛完成項目排序到清單前方，避免原本的自動捲動把提示再次推離畫面。`toast-scroll.spec.ts` 與 `toast-visibility.spec.ts` 手機／桌機共 4/4 通過，並目視 `docs/uat/evidence/mobile-A6-long-page-notice.png`；目前只涵蓋這兩種提示情境，A6 尚不能整項判 PASS。修改後 typecheck 通過；修改前單元測試 129/129、build 通過。A–G 完整驗收與 G9–G11 仍未完成，仍未達 commit/push 門檻。

17:26 補充：目視桌機截圖發現提示雖部分在視窗內卻被固定頁首遮住，先前針對性測試的 viewport 斷言不足；已改成要求完整進入視窗並檢查提示中心未被遮住，再重跑確認。先前 4/4 不能作為此問題修妥的證據。

17:30 續驗：提示捲動預留固定頁首空間；加強完整 viewport 與遮擋斷言後，桌機／手機 4/4 通過，並目視 `docs/uat/evidence/{desktop,mobile}-A6-long-page-notice.png`。先前版本的完整 E2E 已通過 61 項，手機 G1–G8 階段長時間無進展，手動中止，不能算全套通過；最後這次提示修改後尚未重跑完整 E2E。A6 其他提示、B4、D4、F2 與 G9–G12 仍待驗證或實作。

## 2026-11-11 18:34 續驗

- 重新 fetch 指定 GitHub 分支，FETCH_HEAD 與本分支 HEAD 均為 `e6bc733`。
- 最新工作樹：typecheck 通過（`/tmp/laned-current-typecheck.log`）；單元測試 25 檔、129 項通過（`/tmp/laned-current-unit.log`）；build 通過（`/tmp/laned-current-build.log`）；Chrome 桌機／手機 E2E 64/64 通過（`/tmp/laned-current-e2e.log`）。
- 最新獨立新帳號主旅程：手機和桌機各 44 狀態、無未預期錯誤，包含支線、刷新、第 2 階舊頁與 MCP 401；截圖及原始資料在 `independent-1819/`。生活旅程手機和桌機各 37 狀態、無未預期錯誤，截圖和原始資料在 `independent-life-1820/`。部分截圖重新目視，未完成逐圖及全部狀態人工判定。
- 追加版面位移觀測：`independent-cls-1822/journey-raw.json` 中手機信物畫面累計約 0.1017；桌機同處約 0.0167；`independent-life-cls-1823/raw.json` 生活頁除錯誤重試畫面約 0.0022 外均低於 0.001。數值為自文件載入累計的非近期輸入位移，並非逐頁 CLS 規範值。手機結果需查明是否為出門後預期轉場及是否造成可見跳動，D4 繼續 FAIL。
- 生活量測首次手機在第三次活動刷新後等待日記逾時（`independent-life-cls-1821/raw.json`）；重試兩尺寸各 37 狀態通過（`independent-life-cls-1823/`），逾時原因尚未確認，不將重試當成原因已排除。
- 位移來源補測初次遇 4132 服務已停止而連線失敗（`/tmp/laned-journey-sources.log` 的首次內容已由重跑覆蓋）；已重啟本次自有服務。獨立腳本補上失敗時保存目錄、頁面文字與截圖，避免再遺失證據。
- 上表 A6、B4、D4、F2 缺口以及 G9–G12 未完成，仍不合格；不得 commit、push 或宣稱達標。實際外部指定路徑不在可寫範圍，報告保留專案內。
