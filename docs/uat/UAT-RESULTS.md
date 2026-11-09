# 龍角鎮 v1 UAT 結果

2026-11-10（Asia/Taipei），基準 b45b0a0。尚在執行；未宣告可交付。

## 修復與驗證紀錄


- 測試基礎調查：第一次資料隔離用 TRUNCATE users CASCADE 會連帶清掉公共地點，已改為 DELETE FROM users，保留參照資料；僅允許 longjiao_laned_e2e。
- UAT-16 新發現（待 P2-6 一併驗證）：index.html 的外部 Google Fonts 可能延遲 load 事件；一次手機 Leo 在已呈現登入畫面仍等待 load，環境暫停後超時。登入 helper 改等 DOMContentLoaded 再等真實表單，不移除原斷言。

- 2026-11-10 00:41：P2-7 / UAT-01、12、13：測試基礎已完成；原人物情境桌面＋手機 6/6 pass，新手閉環因 P2-2/P2-3 暫 fixme 2；基準單元 100/100、typecheck 0 錯誤。證據 evidence/{desktop,mobile}-{leo,mia,xiaoan}-*.png；p2-7-e2e.log。

- 2026-11-10 00:53：P1-1 / UAT-02 已修：config 未到不顯示 Google；未設定 client 導回中文說明且保留 next。TDD：後端 red 1/12、閃現 red 1 按鈕→green；雙裝置 E2E 2/2、全單元 101/101。證據 evidence/*-UAT-02-google-unavailable.png、p1-1-{red,green}-*.log。P2-7 commits b3d7f01、6186d19。

- 2026-11-10 00:54：P1-2 / UAT-03 已修：完成後切完成了分頁、標記並捲到剛完成項目，保留看看這個事蹟。TDD red 兩裝置連結不存在→green；完成回歸＋原 Mia 雙裝置 4/4、全單元 101/101。證據 evidence/*-UAT-03-completed-step.png。P1-1 commit be41ef9。

- 2026-11-10 02:11：P1-3 / UAT-04 已修：<640px 預覽上置、體型配件三欄、八色色票同列；手機儲存位置 <2110px，無水平溢出，桌面不改排列。TDD mobile red→green，雙裝置 2/2 pass。證據 evidence/*-UAT-04-character-layout.png。P1-2 commit 54e41f8。

- 2026-11-10 02:11：P1-4 / UAT-05 已修：手機參考卡以徽章、全寬引用、按鈕三列排列。TDD mobile red 引用僅7.58字寬→green ≥12字寬、卡高<200px、無溢出，雙裝置 2/2 pass。證據 evidence/*-UAT-05-reference-card.png。P1-3 commit 5b0b4bd。

- 2026-11-10 02:21：P2-1 / UAT-06 已修：初次儲存以頁內訊息提示下一步，聚焦並捲到想做的事；不使用浮動 toast。TDD desktop red 未聚焦→雙裝置 green 2/2，並逐一 boundingBox 確認 status 不遮 input/select。證據 evidence/*-UAT-06-next-want.png。P1-4 commit 61e513c。

- 2026-11-10 02:22：P2-2 / UAT-07 已修：新增 200 /api/session（匿名 me:null、no-store），前端改用探測端點；/api/me 及寫入原 401 合約不變。TDD red 三個單元及訪客雙裝置 console401→green：訪客首頁/地點/事蹟 console=0，E2E 2/2、session+原 auth 15/15。證據 evidence/*-UAT-07-visitor-*.png。P2-1 commit 11cfbb7。

- 2026-11-10 02:28：P2-3 / UAT-08 已修：非管理者發請求前先檢查權限，回地圖入口。TDD red 6 個 admin 請求→green 0，桌面＋手機 admin 案 2/2。新手 fixme 已移除：桌面閉環 pass；手機於角色頁截圖等待外部 Google Fonts 超時（UAT-16，排入 P2-6），此輪總計3 pass/1 fail，尚不可交付。證據 evidence/*-UAT-08-forbidden.png、*-UAT-01-*。P2-2 commit 7a6cacd。

- 2026-11-10 02:47：P2-4 / UAT-09、09b 已修：保留試用店優先、明確願望次之的既有定位規則；也想做預設只選同區的有效願望，否則沿用來源區域（不再誤選第一件運動願望）。UI 選擇旁清楚說明完成後位置；無願望時後端以第一個來源事蹟區域補足。理由：尊重明確選擇與試用實際店址，避免靜默跨區。TDD red 未指定落 misc/預設 sport→green；雙裝置4/4、全單元105/105。證據 evidence/*-UAT-09*.png。P2-3 commit 8955e31。

- 2026-11-10 03:09：P2-5 / UAT-10 已修：手機訪客 header 顯示登入按鈕，登入狀態載入後才顯示。TDD desktop pass/mobile red 隱藏→green 雙裝置2/2，可點到登入表單。證據 evidence/*-UAT-10-header-login.png。P2-4 commit 9b6e5ac。

- 2026-11-10 04:07：P2-6 / UAT-11、UAT-16 已修：按路由 lazy import（含 Admin、Provider、Character 與現有 SVG TownMap；此版本未使用 Leaflet），build 明確設 production，移除 Google Fonts 外站依賴。TDD：735245 bytes 失敗→最大 334936 bytes 通過；外部字型雙裝置 red→green。全 E2E 30/30（含原三人物×雙裝置及新手 console=0）、單元105/105、typecheck與build成功。證據 p2-6-green-{bundle,e2e,unit}.log、build.log、evidence/*-UAT-16-local-fonts.png。一次並行 build 清空 dist 造成 server ENOENT，測試仍30/30；後續完整回歸將採序列 build/E2E，消除此執行干擾。P2-5 commit c1442ab。

- 2026-11-10 04:07：P0 公開站唯讀檢查：127.0.0.1:5200/healthz=200；公開首頁 curl TLS unexpected EOF（HTTP 000），web 工具也無法存取。未啟動或重啟5200，未修改 /workspace/deploy、tunnel 或 relay。公開首頁200與公開閉環仍 blocked，由 Product Builder 依部署權限接續查驗。

- 2026-11-10 04:47：UAT-14a～14d 新手 UI 已修：空狀態連到地圖、步驟或 AI；第一次角色儲存→寫願望→找靈感依序只突出一個操作；步驟列表只有一個主要操作，展開完成時以完成為主且可取消；測試登入可照說明填寫。提供者審核等待可回地圖，開店/上架依進度突出；管理頁空狀態可繼續。TDD：入口缺失、多個主要操作、測試登入無突出操作 red→green；雙裝置8/8，typecheck成功。首次測試 helper 錯把桌面隱藏tabbar當作可見navigation等待，已改為檢查實際tabbar元素的boundingBox；UAT-14a重跑仍因鏡子缺入口而失敗，證據uat-14a-red-e2e.log。截圖 evidence/*-UAT-14*.png。P2-6 commit a36d7d3。

- 2026-11-10 05:08：完整驗收第一次：typecheck 0、build成功、最大chunk335005 bytes、單元105/105；E2E36 pass /2 fail，均UAT-14d，原因是測試在資料未載完時收集Loading節點，之後nth(1)消失。已在收集空狀態前等所有「載入中」消失，保留逐個入口與版面斷言，重跑全38案。UI產品修復commit 515454c。

## Bug → 驗收與修復 commit 對照

| Bug | 已修與驗收方式 | commit |
|---|---|---|
| P1-1 | 已修；延遲config與未設定OAuth的雙裝置UAT-02，原auth單元 | be41ef9 |
| P1-2 | 已修；完成後3秒內顯示標題與事蹟入口UAT-03 | 54e41f8 |
| P1-3 | 已修；390寬角色選項≥3欄、儲存≤2110px、無水平溢出UAT-04 | 5b0b4bd |
| P1-4 | 已修；引用≥12字寬、卡高<200px UAT-05 | 61e513c |
| P2-1 | 已修；願望focus/viewport與訊息不遮表單UAT-06 | 11cfbb7 |
| P2-2 | 已修；匿名session200、保留受保護API401，訪客console0 UAT-07 | 7a6cacd |
| P2-3 | 已修；非管理者admin API請求0、說明與回地圖UAT-08 | 8955e31 |
| P2-4 | 已修；音樂來源預設留音樂、手動運動保留選擇且UI說明UAT-09/09b | 9b6e5ac |
| P2-5 | 已修；手機header登入可見可點UAT-10 | c1442ab |
| P2-6 | 已修；每個JS chunk<400000 bytes、原人物及新手雙裝置回歸UAT-11/16 | a36d7d3 |
| P2-7 | 已修；PW_CHANNEL與雙viewport、新手逐步截圖console0 UAT-01/12/13 | b3d7f01、6186d19 |
| UAT-14 | 已修；空狀態、主要操作、手機邊界與tabbar，雙裝置8/8 | 515454c |
| P0公開站 | 本機5200健康200；公開站連線未成功，部署操作被使用者工作範圍禁止，仍blocked | 無部署變更 |

- 2026-11-10 05:50：完整回歸第二次37 pass /1 fail（手機小安），UAT-14d兩裝置均pass。小安trace的兩個試用課API回200，但接收延遲約224秒；原90秒案例耗盡，最後停在steps載入中。保留原測試、timeout及斷言，原小安與UAT-18雙裝置定向重跑4/4，手機小安4.1秒通過。未以重試或增加timeout掩蓋。

- 2026-11-10 05:50：UAT-18 / 審查新發現已修：/api/config暫時失敗不再無限載入；顯示中文錯誤與重新載入入口，重試成功後可直接登入，Google未設定時仍全程隱藏。TDD雙裝置red→green，含原小安回歸4/4，typecheck成功。證據uat-18-{red,green}-e2e.log、evidence/*-UAT-18-*.png。獨立唯讀審查未發現其他明確程式回歸。

- 2026-11-10 07:26：UAT-15 / UAT-17 探索式測試：發現長英文連結撐寬步驟頁（桌面scrollWidth2163>1280，手機也超出390）。UAT-17已修：頁面內容允許長字串斷行，不截字、不隱藏溢出；斷言改用明確project viewport（1280/390），避免手機被撐寬後innerWidth也變大造成漏測。TDD red→green，五頁（我、完成步驟、事蹟、鏡子、角色）雙裝置均無溢出；探索＋UI12/12。證據exploratory-{red,green}-e2e.log、evidence/*-UAT-17-long-content-{0..4}.png。
- UAT-15測試修正：提交後先等成功導向與步驟標題，再重新整理；不在尚未收到成功回應時中斷提交。補驗證來源音樂區、未先設定角色/願望仍能完成、重新整理後資料保留，以及session失效後登入回到原/steps。最後全套雙裝置通過且console/pageerror=0。證據evidence/*-UAT-15-*.png。
- UAT-18修復commit：5568557；UAT-14資料載入等待修正commit：02c26c9。

## 最終驗收（2026-11-10 07:27 Asia/Taipei）

本機程式碼驗收通過，公開站仍blocked。分支codex/uat-v1，基準b45b0a0；未push、未修改remote、未操作部署/tunnel/relay或其他DB。UAT-17修復commit：7d3630b。

| 檢查 | 結果 | 證據 |
|---|---|---|
| pnpm typecheck | PASS，0錯誤 | final-typecheck.log |
| pnpm build | PASS | final-build.log |
| node scripts/check-web-chunks.mjs | PASS，最大335411 bytes（<400000） | final-bundles.log |
| TEST_DATABASE_URL=專用test DB pnpm test | PASS，20檔105/105；原100個保留 | final-unit.log |
| PW_CHANNEL=chrome E2E_PORT=4131 E2E_DATABASE_URL=專用e2e DB pnpm test:e2e | PASS，44/44，無skip/fixme，1.9分鐘 | final-e2e.log |
| 原小安／Leo／Mia | PASS，三情境×雙裝置6/6 | final-e2e.log、evidence/*-{xiaoan,leo,mia}-*.png |
| 新手閉環UAT-01／探索UAT-15 | PASS，雙裝置；console/pageerror=0 | evidence/*-UAT-01-*.png、*-UAT-15-*.png |
| 手機390×844／桌面1280×800 UI與長字串 | PASS，實際project viewport寬度斷言；頁尾操作不被tabbar遮住 | evidence/*-UAT-14*.png、*-UAT-17*.png |
| 自啟動測試服務 | PASS，4131–4139已無listener | ss本機檢查 |
| P0本機app | PASS，5200/healthz=200（唯讀檢查） | 本節記錄 |
| P0公開首頁及公開閉環 | BLOCKED，curl TLS unexpected EOF，HTTP000，未能驗證首頁200 | 本節記錄；未修改DEPLOY_STATUS.md，依使用者禁止操作/workspace/deploy規則 |

### 本輪完整執行的失敗紀錄

- UAT-14首次完整36pass/2fail：測試收集暫時Loading節點；02c26c9修正等待條件，保留逐項入口斷言。
- 接續37pass/1fail：手機小安在API200接收約224秒停頓後耗盡90秒；原案例定向重跑通過，未改timeout/斷言。
- pre-exploration-attempt1.log：39pass/1fail（桌面新手在Connect載入中；API與chunk均200、沒有console錯誤，原因未能確定）。
- pre-exploration-attempt2.log：39pass/1fail（手機UAT-02在2秒延遲採樣中超過90秒；與工具長時間等待停頓同時發生）。
- exploratory-red-e2e.log：4fail，兩個為探索腳本尚未等提交完成就重新整理，兩個揭露實際UAT-17長字串溢出；均已修正，探索＋UI12/12。
- final-e2e-attempt1.log：43pass/1fail（桌面UAT-15截圖期間停頓，字型已載完，案例耗時3.4分鐘）。
- 最後透過連續收集輸出的完整執行：final-e2e.log 44/44，一次通過、retries=0。以上間歇停頓保留紀錄，沒有新增retry或延長timeout；若其他環境再出現，需依trace追查，不能只憑重跑通過認定原因。

UAT-STATUS計數：44次瀏覽器案例執行（22案×雙裝置）＋1個公開站驗收=45；靜態檢查獨立列於上表。公開網址尚不可宣告可供使用者驗收，需Product Builder於部署環境接續確認；本機程式碼與證據已可拉取。

- 2026-11-10 07:49：第2輪基準回歸：typecheck 0、build成功、最大chunk335411 bytes、單元105/105、Chrome桌面+手機原44/44全過（2.4m）。證據round2-{typecheck,build,unit,baseline-e2e}.log。啟動時遇corepack全域快取唯讀，依環境指示改COREPACK_HOME=$PWD/.corepack後通過；未變更套件。5200/healthz唯讀200，公開網址仍TLS unexpected EOF／HTTP000，公開閉環blocked；未操作部署。新增UAT-19/20恢復分支TDD執行中。

- 2026-11-10 07:50：UAT-19/19b、UAT-20新發現：雙裝置6/6 red（round2-recovery-red.log）。來源改私人或建議503仍顯示表單且無回復入口；隨筆PUT503沒有頁內錯誤且有未處理ApiError。已拆為content-recovery與note-recovery兩個spec，以便逐項修復提交；斷言保持。來源修復定向驗證中。

- 2026-11-10 07:56：UAT-19/19b 已修：來源事蹟／試用機會／建議任一載入失敗時先顯示中文說明，提供回地圖與再試一次，不呈現必定失敗的表單。TDD雙裝置4 red→4 green；新增真實私人來源、失效試用連結、建議503後重試，斷言來源參考保留。證據round2-source-green.log、evidence/*-UAT-19*.png。UAT-20兩案仍待修驗證，公開站blocked。

- 2026-11-10 07:57：UAT-20 已修：隨筆儲存失敗顯示中文頁內錯誤，保留原文與分享選擇；儲存期間停用欄位及操作，避免重複提交。TDD雙裝置2 red→2 green；做之前私人、做之後分享兩路徑均驗證重試真實DB寫入、各恰2次請求、pageerror=0。證據round2-note-green.log、evidence/*-UAT-20-*.png。UAT-19修復commit 64398ef。已知程式問題修完，將重跑完整驗收；公開站仍blocked。
