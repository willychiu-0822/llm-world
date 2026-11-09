# 龍角鎮 v1 UAT 結果

2026-11-10（Asia/Taipei），基準 b45b0a0。尚在執行；未宣告可交付。

## 修復與驗證紀錄


- 測試基礎調查：第一次資料隔離用 TRUNCATE users CASCADE 會連帶清掉公共地點，已改為 DELETE FROM users，保留參照資料；僅允許 longjiao_laned_e2e。
- UAT-16 新發現（待 P2-6 一併驗證）：index.html 的外部 Google Fonts 可能延遲 load 事件；一次手機 Leo 在已呈現登入畫面仍等待 load，環境暫停後超時。登入 helper 改等 DOMContentLoaded 再等真實表單，不移除原斷言。

- 2026-11-10 00:41：P2-7 / UAT-01、12、13：測試基礎已完成；原人物情境桌面＋手機 6/6 pass，新手閉環因 P2-2/P2-3 暫 fixme 2；基準單元 100/100、typecheck 0 錯誤。證據 evidence/{desktop,mobile}-{leo,mia,xiaoan}-*.png；p2-7-e2e.log。

- 2026-11-10 00:53：P1-1 / UAT-02 已修：config 未到不顯示 Google；未設定 client 導回中文說明且保留 next。TDD：後端 red 1/12、閃現 red 1 按鈕→green；雙裝置 E2E 2/2、全單元 101/101。證據 evidence/*-UAT-02-google-unavailable.png、p1-1-{red,green}-*.log。P2-7 commits b3d7f01、6186d19。

- 2026-11-10 00:54：P1-2 / UAT-03 已修：完成後切完成了分頁、標記並捲到剛完成項目，保留看看這個事蹟。TDD red 兩裝置連結不存在→green；完成回歸＋原 Mia 雙裝置 4/4、全單元 101/101。證據 evidence/*-UAT-03-completed-step.png。P1-1 commit be41ef9。
