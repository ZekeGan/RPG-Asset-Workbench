# Codex 交接總覽

交接日期：2026-10-23（Asia/Tokyo）。產品：RPG Maker 圖片管理／替換桌面工具。交付基準：0.4.0 開發測試版。不是下一版發行，也不是完整 MVP 通過宣告。

## 目前授權：只交接

使用者原話：「目前只交接，不授權開始下一版開發。」本輪允許整理文件、只讀核對來源與準備文件包。不修改應用程式碼、package/lock/config、不安裝套件、不開始修 bug、不寫遊戲、不建立 Git、不推送、不發版。較早的「持續完成 MVP」授權是歷史階段，不可用它繞過目前暫停開發的要求。需求已確認不代表現在可以實作。

## 先讀順序

1. 專案根目錄 AGENTS.md（整合包已合併，不需手動操作），本文件。
2. [DECISIONS.md](DECISIONS.md)：最新已確認決策與規格衝突。
3. [BACKLOG.md](BACKLOG.md)：完整待辦與驗收條件。
4. [OPEN_ITEMS.md](OPEN_ITEMS.md)：尚未定案與技術限制。
5. [MOCKUP_MAP.md](MOCKUP_MAP.md)：原始圖檔及畫面對應；必須實際看圖。
6. [STATUS_AND_TESTS.md](STATUS_AND_TESTS.md)：已交付功能、證據與限制。
7. 原專案 spec-v1.0.0/AGENTS.md、docs/PRD.md、docs/ARCHITECTURE.md、docs/TEST_PLAN.md、docs/SPEC_REVIEW.md（後四項相對 spec-v1.0.0）；原 design/INDEX.md。
8. 原專案 docs/IMPLEMENTATION.md、TECHNICAL_BASELINE.md、TEST_REPORT.md、UPDATE_0.4.0.md。舊版段落是歷史，不代表目前狀態。

## 來源與可信度

- 本文件依這段 Work 專案對話、0.4.0 工作區原始碼、現存測試日誌與原始 Mockup 整理；不是所有歷史聊天的逐字匯出。
- 基準 ZIP：RPG_Image_Tool_0.4.0_Source.zip；SHA-256：226bcf39e6d4bd313bfb50bd0d65914faea8266366d066697e926256a27daab9。
- 基準代碼顯示 package version=0.4.0；本輪未更動版號。
- 交付後使用者回報的需求／錯誤尚未實作。不得因舊報告寫「UI 已調整」就忽略新回報。
- 使用者本機可能有手動修改，本包無法確認其 Git、分支、遠端、未提交修改或環境；本機內容優先保留，先比較再判定。
- 本整合包包含原交付0.4.0應用代碼與交接文件，不含 .git、使用者遊戲／DB／金鑰。reference/ 是歷史文件與設計的唯讀副本；不要覆蓋回原專案。

## 產品目的與技術

Windows 桌面管理 RPG Maker MV/MZ 圖片：掃描、原始資料夾／自訂群組、原圖與替換對照、版本歷史、匯入匯出、明確確認後套用／還原、失敗恢復、多專案。Electron + React + TypeScript，SQLite 索引，Sharp 圖片解碼。正式入口 src/main、src/preload、src/renderer、src/shared；不是 HTML 示意原型。

## 接手第一輪應交付什麼

只讀檢查本機檔案和 Git 狀態，讀完文件及相關 Mockup，回報：實際版本與差異、需求理解、未決項、建議順序。不要直接實作。之後等使用者明確授權才開始修改。

建議未來順序（不是授權／排程）：先處理返回原圖與重新連結，再處理掃描狀態／續掃／離線與增量掃描；接著配對與批量頁／拖放，之後補齊其餘 Mockup 與側欄，最後整合多語言、README 與完整回歸。優先序為交接建議，未由使用者逐項確認。
