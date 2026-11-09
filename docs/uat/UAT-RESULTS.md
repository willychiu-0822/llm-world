# 龍角鎮 v1 UAT 結果

2026-11-10（Asia/Taipei），基準 b45b0a0。尚在執行；未宣告可交付。

## 修復與驗證紀錄


- 測試基礎調查：第一次資料隔離用 TRUNCATE users CASCADE 會連帶清掉公共地點，已改為 DELETE FROM users，保留參照資料；僅允許 longjiao_laned_e2e。
- UAT-16 新發現（待 P2-6 一併驗證）：index.html 的外部 Google Fonts 可能延遲 load 事件；一次手機 Leo 在已呈現登入畫面仍等待 load，環境暫停後超時。登入 helper 改等 DOMContentLoaded 再等真實表單，不移除原斷言。

- 2026-11-10 00:41：P2-7 / UAT-01、12、13：測試基礎已完成；原人物情境桌面＋手機 6/6 pass，新手閉環因 P2-2/P2-3 暫 fixme 2；基準單元 100/100、typecheck 0 錯誤。證據 evidence/{desktop,mobile}-{leo,mia,xiaoan}-*.png；p2-7-e2e.log。
