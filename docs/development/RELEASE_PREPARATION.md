# 1.0 發行準備狀態

2026-10-25；原始碼 0.5.5。此文件是發行準備，不代表已升 1.0、打標籤或發布。

0.5.5 新增掃描確認視窗內的作業提示，typecheck、build 與隔離 Electron UI 驗收通過。以下 0.5.4 hash 及回歸為歷史結果，不用於驗證新版 ZIP；各版校驗值以對應 `.zip.sha256` 為準。

0.5.5 `pack:zip` 通過；成品 `release/RPG-Asset-Workbench-0.5.5-win-x64.zip`，SHA-256：`438df14de9c672cd3544b0c9d477ed5a91a978b4ddc113efa795ed3035739c7f`。使用此版再驗收掃描提示；未提交、推送或發布。

**最新驗證：** `pack:zip` 成功，產生 `release/RPG-Asset-Workbench-0.5.4-win-x64.zip` 與同名 `.sha256`；ZIP 可開啟，內有 EXE、四語說明、MIT、12 份套件授權檔及 0.5.4 更新紀錄，四語文件相對連結可解析，app.asar 版號為 0.5.4。Windows `certutil` 獨立核對 SHA-256 一致：`f9cbc8f462d701f56028763ca95336b7c1c89f18dddb29b5898314d8a9b65cd9`。typecheck 與完整 7 檔 87 項測試通過；原生模組已切回 Electron ABI。這些結果不等於乾淨 Windows、舊資料升級或 LGPL 發行義務驗收。

使用者執行 0.5.3 時回報 `Prepared documentation and 12 package licenses.`，ZIP 亦已建立；最後 `Get-FileHash` 在該 PowerShell 環境不存在。0.5.4 改用 .NET SHA-256，更新紀錄依版本動態納入；仍須重新執行及驗證新版 ZIP、授權文字與校驗值。舊 0.5.3 ZIP 未作為正式驗收。

已加入 `scripts/prepare-release.cjs` 與 `scripts/make-release.ps1`：前者在打包目錄產生四語說明、MIT 與 12 個直接／間接元件的授權文字及 sharp Windows 原生套件的組件清單；後者製作 ZIP 與 SHA-256。`pack:win` 現包含文件步驟，`pack:zip` 產生可攜式 ZIP。0.5.4 腳本已實際執行並核對成品。

圖示已選定方案 02 並納入 EXE／視窗／Header 與四語文件，pack:win 通過，實際 EXE 圖示已擷取核對；見 [0.5.2 更新](../UPDATE_0.5.2.md)。尚未代表簽章或乾淨環境驗收完成。

## 本輪完成

- 四語使用者 README 與互連入口；原 README／START_HERE 歷史內容獨立存檔。
- 根 AGENTS → 開發 INDEX → 當前狀態／歷史規格的閱讀順序；保留原文件路徑與識別碼。
- 使用者選擇 MIT，署名 Zeke Gan；已加入 LICENSE，同步 package.json 作者／授權與 lockfile 根授權 metadata。僅文件與 metadata，不觸發程式更新升版。
- 使用者摘要回報手動測試完成、無重大問題；其後回報排除 PATH 中 Node 後打包程式正常。未提供逐項結果、執行檔 hash 或測試 commit，不把全部人工勾選框自動標 PASS。這也不等同乾淨電腦驗收。

## 發行前仍須完成

- [ ] 乾淨 Windows x64 環境驗收；指定最終成品版本、hash、Windows 版本及結果。
- [ ] 舊版資料升級／資料目錄相容性、最終成品與必要回歸驗收；已回報的小問題若有，補列已知限制。
- [x] 驗證 0.5.4 `pack:win`／`pack:zip` 實際產物、文件連結、12 份授權文字、ZIP 可開啟與 SHA-256 一致。正式產品圖示已完成，建議首版採可攜式 ZIP；目前沒有已提供的簽章憑證，公開前明示可能出現 Windows 未簽章提示。
- [x] 確認 0.5.4 發行資料夾實際納入四語說明、MIT LICENSE 與第三方聲明。build.files 仍只含應用程式資源，使用者文件置於成品旁的 Documentation；定版後需對最終 1.0 成品重驗。
- [ ] 依實際成品核對第三方授權，尤其原生二進位的依賴／通知／來源提供要求；下方只是初步清單，不能代替完整合規核對。
- [ ] 更新四語 README 的版本與發布狀態，確認下載附件、支援範圍、Issues 回報入口；不提供尚不存在的下載連結。
- [ ] 最後確認後升為 1.0.0、建置並驗收該成品，再製作 ZIP、SHA-256、Release 說明與 Git tag。提交、推送與發布留給使用者操作，指令見 [發行操作草稿](RELEASE_NOTES_DRAFT.md)。

## 第三方元件初步盤點（不是完整發行聲明）

以下讀自本機已安裝的 package.json；最終成品還包含間接依賴與打包進 renderer 的元件，必須另核對。

| 元件 | 版本 | 套件宣告授權 |
|---|---|---|
| Electron | 45.0.0 | MIT；另有 Chromium 等第三方聲明 |
| React / React DOM | 19.3.1 | MIT |
| better-sqlite3 | 13.0.3 | MIT |
| sharp | 0.35.5 | Apache-2.0 |
| @img/sharp-win32-x64 | 0.35.5 | Apache-2.0 AND LGPL-3.0-or-later |

現有 `release/win-unpacked` 可見 `LICENSE.electron.txt`、`LICENSES.chromium.html`，分發時應保留。這不證明其他元件已全部涵蓋，尤其不能把所有第三方元件一律標成 MIT。尚未對本機成品做重新打包或授權完整性驗收。

## 自動審核限制

先前對 0.5.3 打包檔案執行唯讀 `node` 檢查時，自動審核曾因用量限制無法完成，指令未執行；不是安全性判定。0.5.4 已由後續實際打包、ZIP 與完整回歸驗證，不沿用前一版失敗結果。原生模組在 Node／Electron 間需依順序切換。

## 本輪檢查與效率

只檢查新文件的相對連結、四語內容一致性與套件 metadata，未執行應用測試或重建成品。後續先完成授權及發行文件納入清單，再產出最終包，避免每整理一份文件就重複打包。
