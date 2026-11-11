# 生活世界驗收進度（未合格）

時間：2026-11-10 16:15（台北）。基底：GitHub cursor/llmworld-uiux-polish，fetch 得 e6bc733；工作區含未提交的生活功能與修正。

- F4 部分 PASS：typecheck、build 成功；單元測試 25 檔、128 項通過。
- 自動化 A–F 子集、G1–G8：`e2e/uiux-checklist.spec.ts` 桌機與手機共 6 項通過。截圖位於 `docs/uat/verify-codex/batch1/`。這不是完整獨立驗收。
- 目視部分：檢視手機今天、活動選擇、活動結果及生活收藏，另看桌面今天；相關圖片為 `mobile-G01-today.png`、`mobile-G03-choices-cancel.png`、`mobile-G05-music-result.png`、`mobile-G07-life-cabinet.png`、`desktop-G01-today.png`。尚未目視所有狀態，不能判定 D1–D5、G7 全部通過。
- 全套 E2E FAIL／未跑完：起初測試匯入 `@lj/core` 解析失敗，已改為相對匯入。重跑後 `connect.spec.ts`、`content-recovery.spec.ts` 前兩項均因第 2 階門禁而未達原測試頁面；目前測試資料未建立達門檻角色。為優先執行獨立檢核，中止其餘測試；不得宣稱全套通過。
- 獨立旅程未完成：手機記錄 44 個狀態、腳本列出 errors=[]，但執行時間過長並於桌面階段中止；尚無完整原始報告，不能以此判定各條 PASS。截圖在同目錄。
- A1–A6、B1–B5、C1–C4、D1–D5、E1–E4、F1–F3、G1–G12：尚未完成逐條獨立判定；G9–G11 的玩家同意、真實來源、life_get 尚未實作完整，不能標 PASS。

修正／後續：調整舊 E2E 的第 2 階前置條件，不弱化原斷言；釐清獨立腳本停滯，完成雙尺寸完整旅程、地圖支線、刷新、MCP 401、所有圖片目視與逐條評分；完成後續 G9–G11，再執行全套驗收。尚未 commit 或 push。

執行環境僅可寫本工作區與 /tmp，指定的 `/workspace/llm-world-uat/uiux/verify-codex/`、`/workspace/llm-world-uat/design/` 及 `/workspace/codex-burn/notes/` 均不在可寫範圍；相關草稿與本紀錄暫存本工作區的 `docs/design/`、`docs/uat/verify-codex/`。
