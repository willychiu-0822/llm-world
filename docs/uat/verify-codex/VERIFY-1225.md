# 生活世界驗收進度：未合格

2026-11-11 12:25（台北）。工作樹未提交；最新 fetch 的 `cursor/llmworld-uiux-polish` 為 `e6bc733`。

本輪針對 1120 報告中的 G5 缺口，新增春夏跨季測試並確認原程式失敗，再讓活動預覽與歷史日記顯示當季故事；手機、桌機獨立新帳號各走七項活動，逐項比對預覽、結果及刷新後日記一致。截圖與資料：`docs/uat/verify-codex/independent-life-1122/`，每尺寸 33 狀態，零瀏覽器錯誤、非預期 API 錯誤、量測到的小點擊區與水平溢出。另目視 `independent-1023/` 的新手旅程兩尺寸首屏，以及官方 G 圖片兩尺寸；畫面中信物明細及郵筒原用「好」，新斷言分別先失敗，再改「收好信物」「關上郵筒」；提示條改「關閉提示」。

已發現待修：生活收藏的四季小燈明細仍用原固定故事，與當季結果不一致（`independent-life-1122/mobile-item-4.png`，對照 `mobile-result-4.png`）。獨立腳本已新增明細一致性斷言，尚待執行與修正。

- PASS：最新程式 `pnpm typecheck`、`pnpm test` 25 檔 129 項、`pnpm build`。
- PASS：季節修正後但按鈕文案修正前的完整 E2E 60/60（`/tmp/laned-1121-e2e.log`）。按鈕文案修正後，桌面檢核通過；手機首次瀏覽器 session 意外關閉、測試失敗，單獨重跑通過（`/tmp/laned-button-green.log`、`/tmp/laned-button-mobile-retry.log`）；關閉原因未確定。
- 未完成：按鈕文案修正後完整 60 項 E2E 正在重跑，不能以之前結果替代；尚未完成所有新舊狀態逐項判定及 G9–G11。

## 逐項判定

未驗完按 FAIL，不計入合格率。A1–A6、B1–B5、C1–C4、D1–D5、E1–E4、F1–F3、G1–G8 均 FAIL（未完成修改後的全部畫面及逐條獨立核對）；F4 FAIL（修改後完整 E2E 尚未結束）；G9、G10、G11 FAIL（同意玩家相遇、生活頁真實經驗入口、`life_get` 尚未實作）；G12 FAIL（整體驗收未完成）。目前不得宣稱 P0 全過或 P1 ≥90%。

下一步：完成進行中 E2E、重現並修收藏明細故事，重新跑 typecheck／test／build／全部 E2E 與雙尺寸獨立驗收，逐條列 A–G 結果；第一批過門檻後才提交與推送，再實作第二批。指定的 `/workspace/llm-world-uat/` 和 `/workspace/codex-burn/notes/` 在此環境可寫範圍之外，設計、驗收與狀態暫存專案內，外部交付未完成。

## 後續進度（同日）

收藏故事一致性的獨立測試先在手機和桌機失敗，修正後兩尺寸各 33 狀態通過，見 `independent-life-detail/` 與 `independent-life-detail-green/`。擴充未領養、失敗重試和空收藏後，兩尺寸各 37 狀態通過，見 `independent-life-final/`；但目視發現 `decorated` 截圖在導頁完成前擷取，該圖不能作為家頁證據，腳本已加入等待且需重跑。

再次目視發現穿著／佈置只有文字，缺少實際物件。已新增失敗測試並改家頁顯示圍巾與小燈；桌機／手機生活 E2E 2/2 通過，截圖 `docs/uat/evidence/uiux-audit/after/{desktop,mobile}-G09-decorated-home.png`。這個修改後 typecheck、129 項單元測試、build 通過；完整 E2E 與更新後獨立雙尺寸驗收仍在進行，整體維持未合格，未 commit／push。
