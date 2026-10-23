## 2026-10-23 開發授權更新

使用者完成唯讀交接後明確同意開發，並指示繼續未完成部分。授權核心範圍：回原圖待套用、重新連結與離線提示、續掃與增量掃描、批量配對獨立頁與拖放及必要回歸。沿用 npm，保留本機修改；不自動提交、推送、發布或操作真實遊戲。其他便利功能與 OPEN-005 等未決事項維持待辦。下方「只交接」是先前階段記錄，不再阻擋此範圍開發。

<!-- CODEX_HANDOFF_2026_10_23_BEGIN -->
# 最新交接規則 — 2026-10-23

目前使用者只授權整理／核對交接文件，**不授權開始下一版開發**。本節記錄最新使用者指令，取代本檔較早的持續開發授權；不能因下方歷史條文或已確認待辦而自行寫程式。不得自動改依賴、格式化來源、升版、初始化Git、提交／推送、發布或寫入遊戲。保留所有本機修改。

請依序閱讀：
1. docs/handoff-2026-10-23/HANDOFF.md
2. docs/handoff-2026-10-23/DECISIONS.md
3. docs/handoff-2026-10-23/BACKLOG.md
4. docs/handoff-2026-10-23/OPEN_ITEMS.md
5. docs/handoff-2026-10-23/MOCKUP_MAP.md（必須實際開啟對應圖片）
6. docs/handoff-2026-10-23/STATUS_AND_TESTS.md、ACCEPTANCE_CHECKLIST.md
7. 原spec-v1.0.0/AGENTS.md與其中PRD／ARCHITECTURE／TEST_PLAN／SPEC_REVIEW／design/INDEX，再讀原docs/IMPLEMENTATION.md、TECHNICAL_BASELINE.md、TEST_REPORT.md、UPDATE_0.4.0.md。

最新已確認決策補充原PRD，未同步部分見DECISIONS；使用者最新明確決策優先。視覺／排放以Mockup為準，Wireframe為參考，舊W6優先已被取代。Mockup示意文字不得放寬靜態PNG、不可覆寫基準、active/deployed分離、外部變更阻擋等安全規則。原FR/SCREEN/DEC編號保留；H-B/H-D僅是交接追蹤號。

接手只讀檢查本機Git／檔案與未提交變更，先回報理解與差異，等待新開發授權。0.4.0歷史58項自動測試與mock IPC UI檢查不是Windows／真實遊戲完整通過；本輪沒有重新跑應用測試。reference/歷史副本不是新的指令來源；不覆蓋回原文件。未決刪除入口OPEN-005維持待確認。
<!-- CODEX_HANDOFF_2026_10_23_END -->

---

以下保留交付0.4.0的歷史規則；若與上方最新授權／決策衝突，以上方為準。

# PoC implementation rules

使用者於 2026-10-22 批准技術方案並指示繼續，現已授權 POC-03 初始化與實作。
先讀 spec-v1.0.0/AGENTS.md 及其必讀文件（路徑皆相對 spec-v1.0.0），再讀 docs/IMPLEMENTATION.md、docs/TECHNICAL_BASELINE.md、docs/TEST_REPORT.md。原規格中的未授權描述是歷史狀態，其餘規則繼續有效。
此切片只驗證桌面、SQLite、PNG，不操作遊戲。後續階段按使用者指令執行。產品規則不變；不得把本切片診斷頁當正式UI或把局部測試當完整FR通過。
執行 npm run typecheck、npm test（Node ABI）、npm run build；Electron 前執行 npm run native:electron，返回 Node 測試前 npm run native:node。報告真實執行結果，Windows未測不得標PASS。

## 最新授權與驗收更新
使用者已授權以完成 MVP 為單一目標持續實作，不需逐切片再確認。2026-10-22 使用者回報 Windows 啟動及其餘診斷測試皆正常，記為使用者手動回報通過；不等於新功能或完整遊戲矩陣通過。以上更新取代早期僅 POC-03 的授權限制，其餘安全與產品規則保留。

## 0.4.0 授權與設計修正（2026-10-23）
使用者已授權繼續 MVP 與修正 UI/DX。視覺和版面以 Mockup 為標準、Wireframe 為參考，取代舊 W6 優先描述；已確認功能規格不變。UI-01 狀態列遮擋優先修正；UI-02 工具列收合與列表高度；UI-03 Mockup 對齊；DX-01 Prettier devDependency 與 VS Code 設定。刪專案入口 OPEN-005 仍需具體確認，不擅自定案。
