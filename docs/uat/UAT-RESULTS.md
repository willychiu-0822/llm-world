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
