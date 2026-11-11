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

## 2026-11-11 20:26 續驗

- 從 GitHub 再次 fetch `cursor/llmworld-uiux-polish`，`FETCH_HEAD` 與目前分支 HEAD 均為 `e6bc733`；既有未提交工作保留。
- 現有工作樹 `pnpm typecheck`、`pnpm build` 通過；`pnpm test` 25 檔 129 項通過，使用專用 `longjiao_laned_test`。
- 手機信物轉場的舊位移記錄顯示 `.baby-actions` 寬度由 304px 變為 232px；該記錄之後工作樹已加固定寬度。重新執行 `e2e/home-layout-stability.spec.ts`，桌機及手機 2/2 通過，斷言出門前後操作區寬度及小龍垂直位置穩定。這不是所有頁面 CLS 的驗證；D4 仍 FAIL（未驗完）。
- 本次目視既有截圖 `independent-1819/desktop-07-home.png` 與 `independent-life-1820/mobile-today.png`；兩圖分別呈現桌機家頁雙欄、手機今日畫面及單一主按鈕。無法由兩張圖推定全部畫面合格。
- 完整桌機／手機 E2E 正在執行，結果待補；前述 A6、B4、D4、F2 與 G9–G12 的缺口仍在，本批尚未達驗收門檻。
- 本次完整 Chrome 桌機／手機 E2E **66/66 通過**，資料庫 `longjiao_laned_e2e`、埠 4131；完整輸出 `/tmp/laned-1120-full-e2e.log`。測試服務已隨 Playwright 結束。這不能取代 A–G 的逐條獨立驗收，整體仍未合格。

## 2026-11-11 20:33 續驗

- 再次 fetch 指定 GitHub 分支，`FETCH_HEAD` 與 HEAD 仍為 `e6bc733`；保留既有未提交工作。
- 新增 `e2e/keyboard-navigation.spec.ts`，以實際 Tab 走訪家、地圖、收藏櫃、今日、生活收藏、接下、步驟、新步驟、連接、設定與通知頁，檢查所經焦點的可見樣式及主要內容中至少一個操作可抵達；桌機與手機各一項通過，記錄 `/tmp/laned-keyboard-final.log`，截圖 `docs/uat/evidence/{desktop,mobile}-keyboard-navigation-0-0.png`。服務已停止。
- 此測試沒有走完領養、地點、信物與所有對話框的鍵盤操作，亦未驗證每個操作均能以鍵盤完成；F2 仍按 FAIL 記錄。A6、B4、D4 和 G9–G12 的缺口仍在，未達本批交付門檻；不將新測試結果視作整份驗收通過。

## 2026-11-11 20:37 續驗

- 擴充 `e2e/keyboard-navigation.spec.ts`：以 Tab／Enter 走領養、輸入名字、孵化、地點信物對話框，驗證 Esc 關閉後焦點回到觸發按鈕，再以鍵盤接下信物。桌機及手機連同原主要頁面測試共 4/4 通過，輸出 `/tmp/laned-keyboard-2039.log`；測試啟動的 4131 服務已停止。
- 初次測試因前置信物落在萬事屋，卻導向音樂坊而失敗；修正測試路徑後通過。此結果不代表所有對話框及操作已驗完，F2 仍為 FAIL；A6、B4、D4 與 G9–G12 的缺口也仍存在。第一批尚未達交付門檻，未 commit 或 push。

## 2026-11-11 20:39 續驗

- 在 `e2e/uiux-checklist.spec.ts` 加入 B4 測試，以第 2 階帳號及一項已完成的生活活動，逐一重新整理家、地圖、萬事屋、收藏櫃、今天、生活收藏、接下、步驟、新步驟、連接、設定及通知，共 12 頁；檢查頁面內容及前後星星、階段、今日日記、生活收藏一致。桌機／手機 2/2 通過，記錄 `/tmp/laned-reload-integrated.log`，截圖 `docs/uat/evidence/{desktop,mobile}-B4-*.png`。測試服務已停止。
- 測試以 API 準備第 2 階資料，並非新帳號逐屏人工驗收；未涵蓋所有彈窗、編輯中狀態及動畫，因此 B4 仍為 FAIL。A6、D4、F2 和 G9–G12 缺口亦仍在；本批尚未達交付門檻，未 commit 或 push。

## 2026-11-11 20:42 續驗

- 增加生活活動和收藏的鍵盤實測：Tab／Enter 開啟活動、Esc 返回焦點、確認活動、收好結果、打開收藏並以 Esc 返回焦點。Chrome 桌機與手機各一項，共 2/2 通過；截圖為 `docs/uat/evidence/desktop-keyboard-navigation-0-0.png` 和 `docs/uat/evidence/mobile-keyboard-navigation-0-0.png`。測試服務已停止。
- F2 仍未涵蓋所有對話框及動作，A6、B4、D4 和 G9–G12 的既有缺口亦未消除；整體仍不合格。這次只跑新增測試，未重跑完整套件。
- 本次檢查發現 `.session-d.git` 未設定 remote，且 `FETCH_HEAD` 為空；目前保留的遠端追蹤參照與工作分支仍在 `e6bc733`，但本次無法確認 GitHub 最新版本或推送。先前報告記載的 fetch 結果不等同本次查證。

## 2026-11-11 20:44 續驗

- 從 `/workspace/deploy/llm-world` 的唯讀 Git 設定辨識 GitHub 來源後，用明確網址 fetch `cursor/llmworld-uiux-polish`，`FETCH_HEAD` 與 HEAD 都是 `e6bc733`；未更動 remote。
- 新增連接頁複製網址與 Codex 指令提示的 A6 測試：桌機／手機共 2/2 通過，測試實際複製、確認提示完整可見、不被遮蓋、不與視窗內操作元素重疊，以及明確關閉。已目視 `docs/uat/evidence/desktop-A6-copy-url.png`、`docs/uat/evidence/mobile-A6-copy-codex.png`。其他提示情境尚未逐一檢核，A6 整項仍未完成。
- 最新 `pnpm typecheck`、`pnpm build` 通過；`pnpm test` 使用專用測試庫，25 檔 129 項通過。完整 Chrome 桌機／手機 E2E 正在執行，記錄 `/tmp/laned-2044-e2e.log`，結果待補。
- 第一批完整驗收仍未達門檻；A6、B4、D4、F2 有未驗狀態，G9–G11 未實作。未 commit 或 push。指定外部報告、設計與狀態路徑在工作區可寫範圍之外，成果仍保留於專案內。

## 2026-11-11 20:48 續驗

- 人工目視手機訪客、地圖、地點、信物、登入與領養截圖時，發現領養配色頁固定操作列蓋住頭飾顏色。新測試在修正前桌機 PASS、手機 FAIL，列出 7 個受遮擋選項。改為領養內容獨立捲動後，桌機／手機 2/2 通過：逐一點擊全部顏色並確認選中，下一步保持可見；目視 `docs/uat/evidence/mobile-adopt-overlap-0-0.png`。
- 20:44 完整 E2E 不可採信：我同時啟動另一個 Playwright 測試，共用輸出路徑及會清除使用者的 fixture。G1–G8 有 trace 檔遭刪除的 ENOENT；G8 也失敗，已中止受干擾的整套。之後一律循序執行，修正後完整桌機／手機 E2E 在 `/tmp/laned-2048-e2e.log` 重跑，結果待補。
- 新手與生活畫面尚未全部重新目視，A6、B4、D4、F2 未驗缺口與 G9–G11 未實作仍在；不可宣稱合格或交付。

## 2026-11-11 20:50 續驗

- 桌機領養配色頁的「下一步」首屏只露出約 47.6%；加上完整進入 viewport 的斷言後，桌機 FAIL、手機 PASS。縮小桌機預覽後重新執行，桌機與手機 2/2 通過，並逐一點選全部顏色。測試為 `e2e/adopt-overlap.spec.ts`。
- 因發現上述問題，在桌機部分執行期間中止 `/tmp/laned-2048-e2e.log`，不能算完整通過。最新 CSS 與測試正在獨立重跑完整 E2E，記錄 `/tmp/laned-2050-e2e.log`；完整結果待補。新手與生活全旅程逐圖、A–G 缺口仍未驗完，整批尚不合格。

## 2026-11-11 20:55 續驗

- 最新完整 Chrome E2E：**77/78 通過、1 失敗**（`/tmp/laned-2050-e2e.log`）。手機 B4 重新整理收藏櫃時顯示載入中，隨後 page/context/browser 提前關閉；trace 和錯誤資訊保存於 `/tmp/laned-b4-failure-2050/`。不能宣稱整套通過。
- B4 單獨循序重跑桌機、手機 2/2 通過；這不能證明完整執行中提前關閉的根因已排除。失敗 trace 未包含瀏覽器追蹤，只留下 test.trace，原因仍需調查。測試服務已停止。
- 目視本次 `docs/uat/evidence/{desktop,mobile}-adopt-colors-initial.png`，主按鈕完整顯示；手機配色區可捲動且不與操作列重疊。A–G 尚未全部逐條獨立驗收；後續玩家同意、公開經驗入口與 `life_get` 未實作，仍不合格。未 commit、未 push。

- B4 手機循序重複 5 次均通過（`/tmp/laned-b4-repeat.log`），服務已停止；整套時頁面關閉的原因仍未查明，不以重跑覆蓋完整 E2E 的 77/78 失敗結果。

## 2026-11-11 22:20 續驗

- 明確網址 fetch 指定 GitHub 分支，`FETCH_HEAD` 與工作分支 HEAD 同為 `e6bc733`；保留全部既有未提交變更。
- 針對上次完整測試的手機 B4 提前關閉，檢查留存 trace；其中沒有瀏覽器追蹤，不能判定根因。新一次完整 Chrome E2E **77/78**：手機 G8 測試注入 503 後停在載入中並逾時，證據 `/tmp/laned-g8-failure-2109/`；trace 記錄 503，未確認畫面未更新的原因。桌機 G8 同次通過。單獨重跑 G8 桌機／手機均通過，不能以此消除間歇性風險。
- 發現第 2 階完成表單送出中仍可按完成。新增 `e2e/step-completion-submit.spec.ts`，以攔截請求延遲回應並同步點兩次；修正前桌機／手機均因按鈕未停用失敗（`/tmp/laned-completion-red.log`）。修正後使用同步防重入、送出中提示與停用表單欄位；最終版本桌機／手機回歸與 G8 共 4/4 通過（`/tmp/laned-2111-target.log`，截圖 `docs/uat/evidence/{desktop,mobile}-step-completion-submit-0-0.png`）。
- 最新 typecheck、build 通過（`/tmp/laned-2111-typecheck.log`、`/tmp/laned-2112-build.log`）；最新單元與含新案例的完整 E2E 正在執行，結果待補。A6、B4、D4、F2 未驗範圍及後續 G9–G11 仍未完成；不可宣稱合格、提交或推送。指定外部報告／設計／狀態目錄不在本執行環境可寫範圍，記錄暫留專案內。

## 2026-11-11 23:34 續驗

- 最新工作樹 typecheck、build、單元測試 129/129 通過（`/tmp/laned-2111-typecheck.log`、`/tmp/laned-2112-build.log`、`/tmp/laned-2112-unit.log`）。
- 新增案例後全套 E2E **78/80，未通過**（`/tmp/laned-2112-e2e.log`）：桌機 Mia 等待地點信物時逾時，手機 B4 刷新生活收藏時停在載入中；兩份 trace 分別保存在 `/tmp/laned-mia-failure-2229/`、`/tmp/laned-b4-failure-2240/`。兩項測試執行期間各有數分鐘停頓；未確定原因，不將其歸咎於產品或環境。
- 單獨循序重跑 Mia 和 B4，桌機／手機共 4/4 通過（`/tmp/laned-2334-retry.log`）；不能證明間歇性問題已排除。測試服務隨 Playwright 停止。
- 上述表格仍為未合格：A6、B4、D4、F2 尚有未驗範圍，G9–G11 尚未實作，完整 A–G 新帳號雙尺寸獨立驗收未完成。未 commit 或 push。外部指定路徑超出目前可寫根目錄，文件與驗收留在本專案內。
