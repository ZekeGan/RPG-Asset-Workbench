# 開發與 AI 接手入口

使用者操作見 [繁中 README](../../README.md)，其他語言由該頁互連。這裡是工程文件入口；目前程式版號 0.5.5，正在準備發行，尚未發布 1.0。最新圖示更新見 [0.5.2](../UPDATE_0.5.5.md)。

## 必讀順序

已讀且未變動的文件不必重讀；沿用現有上下文，只讀與任務相關段落。全新接手依序閱讀：

1. 根目錄 [AGENTS.md](../../AGENTS.md)：當前授權、升版與效率規則；使用者最新明確決策優先。
2. [發行準備狀態](RELEASE_PREPARATION.md)、[0.5.1 更新](../UPDATE_0.5.1.md)、[最新需求](../NEXT_REQUESTS.md)、[測試報告](../TEST_REPORT.md)、[最終手動清單](../MANUAL_RELEASE_CHECKLIST.md)。區分使用者回報、自動測試、待驗收，不能沿用歷史 PASS 代替本次結果。
3. 歷史交接基準：依序 [HANDOFF](../handoff-2026-10-23/HANDOFF.md)、[DECISIONS](../handoff-2026-10-23/DECISIONS.md)、[BACKLOG](../handoff-2026-10-23/BACKLOG.md)、[OPEN_ITEMS](../handoff-2026-10-23/OPEN_ITEMS.md)、[MOCKUP_MAP](../handoff-2026-10-23/MOCKUP_MAP.md)、[STATUS_AND_TESTS](../handoff-2026-10-23/STATUS_AND_TESTS.md)、[ACCEPTANCE_CHECKLIST](../handoff-2026-10-23/ACCEPTANCE_CHECKLIST.md)。做對應 UI 時實際開啟 Mockup；歷史未授權或未決狀態以後續決策修正。
4. [原規格 AGENTS](../../spec-v1.0.0/AGENTS.md)，再依序閱讀其 PRD、ARCHITECTURE、TEST_PLAN、SPEC_REVIEW、design/INDEX。路徑相對 spec-v1.0.0；保留 FR／SCREEN／DEC 與 H-B／H-D 識別，不因整理文件重編號。
5. [實作紀錄](../IMPLEMENTATION.md)、[技術基準](../TECHNICAL_BASELINE.md)、[0.4.0 更新](../UPDATE_0.4.0.md)，再依序看 [0.5 核心變更](../DEVELOPMENT_0.5.md)、[專案管理變更](../DEVELOPMENT_NEXT.md)、[四語變更](../DEVELOPMENT_LANGUAGES.md)、[0.5.1 更新](../UPDATE_0.5.1.md)，理解後續決策如何補充原規格。
6. 最後檢查相關程式與本機 Git 差異，不覆蓋使用者修改。主要路徑：`src/main` 檔案／資料庫與安全檢核、`src/preload` IPC 橋接、`src/shared` 合約／翻譯、`src/renderer` UI、`tests` 驗證。

## 不變的產品規則

固定原圖不可覆寫；選用與部署分離，匯入不寫遊戲；外部變更阻擋套用與還原。永久刪除只清理工具管理資料，須確認失去還原能力，遊戲保持當前狀態。圖片來源與像素限制以當前實作及最新開發紀錄為準，不能用 Mockup 文案放寬安全規則。

## 本機開發與驗證

沿用 npm；依 package.json 的固定依賴與 scripts，不為文件整理安裝／升級套件。

```powershell
npm ci
npm run native:node
npm run typecheck
npm test
npm run build
npm run native:electron
npm run dev
```

上列是新環境完整流程，局部修改只跑相關驗證。Node／Electron 原生模組 ABI 不同，切回 Node 測試前先執行 `npm run native:node`；再開 Electron 前執行 `npm run native:electron`。不要同時重建兩種 ABI。Electron 啟動環境如帶有 `ELECTRON_RUN_AS_NODE`，只在該程序環境清除它。

打包：`npm run native:electron` 完成後執行 `npm run pack:win`，產出 `release/win-unpacked` 目錄；不是安裝程式。必須分發完整目錄，並完成 [發行準備](RELEASE_PREPARATION.md)。文件更新不升版；每個完成的程式更新批次依 AGENTS 升版，不自行提交或發布。

## 歷史存檔

- [原 README](README_HISTORY.md)：保留當時內容，僅修正搬移後的 Markdown 相對連結。
- [原 START_HERE](START_HERE_HISTORY.md)：歷史交接入口，不代表現在仍停在 0.4.0。
- `docs/handoff-2026-10-23` 與其 manifest 原封保留；歷史原型、reference 不是新指令來源。

原工程文件保留既有路徑，避免破壞交接鏈結；今後開發與 AI 文件統一從本索引進入。
