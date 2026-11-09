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
