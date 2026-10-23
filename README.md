# 0.4.0 Codex 交接整合包

**先讀 [START_HERE.md](START_HERE.md)。** 原始碼與最新交接文件已整合，AGENTS.md已更新，無須手動合併。解壓後在Codex開啟此資料夾即可先做只讀交接；不需先安裝或建置。

這是原交付0.4.0的文件整合，不是新功能版本；未包含使用者本機手動修改或Git歷史。最新待辦與已確認決策以docs/handoff-2026-10-23/為準，下方為原交付說明。

---

# RPG Image Tool — 0.4.0 開發測試版

已修正彈窗層級、工作臺工具列收合與列表高度，依 Mockup 調整主要頁面，加入 Prettier。新增群組、批量匯入、MV／MZ 標準加密讀寫、重新連結、原尺寸預覽及儲存故障處理。

請從 [0.4.0 更新與 Windows 操作／驗收步驟](docs/UPDATE_0.4.0.md) 開始；驗證證據見 [測試報告](docs/TEST_REPORT.md)。本包為原始碼，沒有已驗證的 Windows exe；完整 MVP 尚待實機驗收與專案刪除入口確認。

## 開發指令

`npm run format` 整理程式碼；`npm run format:check` 檢查格式；`npm run typecheck`、`npm test`、`npm run build` 驗證程式。VS Code 安裝推薦的 Prettier 擴充後，儲存時自動格式化。

---

以下為歷史版本紀錄，不代表 0.4.0 狀態。

# 最新版本：0.3.0 開發測試版

請先閱讀 [更新與 Windows 手測步驟](docs/UPDATE_0.3.0.md)。以下舊版紀錄保留作背景，不代表新版功能狀態。

# RPG Image Tool — 開發版 0.2.0

新增未加密 MV／MZ 專案掃描、固定原始圖片備份、專案切換、資料夾分類、搜尋／狀態篩選、預覽背景、原圖預覽與詳細內容、掃描取消及逐檔錯誤。此版本仍在 MVP 開發中，尚無匯入版本、匯出、套用、還原或加密讀取。

## 更新與啟動

建議解壓到新的資料夾，保留舊版原始碼以便比對。專案名稱保持不變，Electron userData 的既有診斷資料保留；新專案資料也存放於該工具資料目錄，不在原始碼資料夾。

你的 Windows 環境已完成 0.1.0 手動測試。新目錄依序執行下列指令，每步成功才繼續：

```powershell
npm ci
node node_modules/electron/install.js
npm run native:electron
npm run dev
```

若沿用舊目錄，先停止程式再更新原始碼，勿同時開啟新舊版本。Visual Studio C++ Build Tools 與 Python 沿用你已配置的環境。

## 這次請測試

1. 按「建立專案」，填名稱並確認來源是未修改遊戲，選擇未加密 MV 測試副本。可以選遊戲外層或包含 data/js/img 的根目錄。
2. 確認列表出現素材，資料夾與檔名正確，原圖可預覽；測搜尋、注意事項篩選及背景切換。詳細內容顯示尺寸與原始 SHA-256。
3. 同樣建立未加密 MZ 專案，切換兩個專案，確認素材不混用。
4. 關閉並重開，確認兩個專案與素材清單仍在；對同一遊戲位置再建案應被阻擋。
5. 若需要測取消，用另一份可拋棄的遊戲副本。取消後僅保留已完成的原圖與清單，狀態標示取消。此版本尚無續掃及刪專案入口，不要反覆使用大量副本測試。

請回報 MV／MZ 各自的引擎版本、素材大約數量、是否正常預覽、重啟是否保留，以及任何錯誤訊息。這次不需要操作替換或還原，也不需要提供私人遊戲檔案。

## 已知邊界

- 靜態 PNG 暫定 32 MiB / 16,777,216 像素上限仍保留；不是宣告最終 MVP 尺寸限制。
- 加密遊戲目前明確提示尚未開放，不能將此版當四格相容性驗收。
- 圖片清單每頁 30 筆，預覽在可見時載入；圖片讀取／解碼依序處理。詳細頁目前為功能子集，完整頁面與版本操作仍待實作。
- 遊戲檔案僅唯讀；原始副本保存於工具 userData/projects 下。無自動清理或覆寫原圖功能。
- 取消／中斷／失敗專案可以查看已保存素材；續掃與清理尚未開放，不標示為完整可套用專案。
- 0.1.0 Windows 診斷測試由使用者回報通過；0.2.0 GUI 與真實遊戲掃描待本輪人工驗收。

詳細測試結果見 docs/TEST_REPORT.md，實作狀態見 docs/IMPLEMENTATION.md。

---

以下是 0.1.0 原始操作說明（歷史參考）：

# RPG Image Tool — PoC 0.1.0

這是 POC-03 原始碼交付，不是完整工具，也不含 Windows 可執行檔。

目前提供：Electron 診斷視窗、SQLite 測試文字保存/讀回、選擇靜態 PNG、完整解碼、縮圖預覽、來源 SHA-256、基本無效格式阻擋。尚未操作任何遊戲檔案。

## Windows x64 執行

需要 Node.js 24（64 位元）與 npm。ARM64、最低 Windows 版本尚未驗證。解壓後，在本目錄開啟 PowerShell：

```powershell
npm ci
npm run typecheck
npm test
npm run native:electron
npm run dev
```

每步須成功才進下一步。若 Electron 二進位未下載，執行 `node node_modules/electron/install.js` 後重試。原生依賴如需本機編譯，可能需要 Python 及 Visual Studio C++ Build Tools；請先提供錯誤紀錄，不必關閉安全防護或改用不明下載。

要建立解壓即執行的目錄：

```powershell
npm run pack:win
```

成功後開啟 `release/win-unpacked/RPG Image Tool PoC.exe`。分發時須保留整個 win-unpacked 目錄，不可只複製 exe。此指令尚未在 Windows 驗證；Linux 跨編譯已遭原生套件阻擋。

Electron 與一般 Node 的原生模組 ABI 不同。執行 Electron 重建後若要再跑 `npm test`，先 `npm run native:node`；再次啟動桌面前先 `npm run native:electron`。不要同時執行兩種重建或打包。

## 手動驗收

1. 啟動後無空白畫面或原生套件錯誤，SQLite 顯示 `wal / FULL=2 / FK=1`。
2. 輸入「重啟測試 001」，按保存；收到保存成功後關閉整個程式。重新啟動，文字與時間必須保留。
3. 選擇自備靜態 PNG，顯示檔名、正確尺寸、透明能力、SHA-256 與預覽。來源檔內容應不變。
4. 取消選檔，應顯示取消；選損毀 PNG、偽裝為 .png 的 JPEG、APNG 均應顯示阻擋原因，不顯示舊圖為成功結果。
5. 請回報 Windows 版本、CPU 架構、執行方式、每項結果與錯誤文字。測試圖片不必傳整套遊戲。

診斷上限 32 MiB / 16,777,216 像素是本切片資源保護，尚非正式產品限制。預覽可縮小，來源圖片不改寫。這個版本不會保存圖片版本，也不會自動恢復預覽。

詳細狀態見 [測試報告](docs/TEST_REPORT.md) 與 [實作範圍](docs/IMPLEMENTATION.md)。完整產品基準在 spec-v1.0.0；內含的「尚未授權開發」是歷史狀態，已由本次授權更新，產品規則未變。
