# 0.5.3 發行候選準備 — 2026-10-25

本版將 Windows 可攜式目錄的四語使用說明、MIT LICENSE、圖示與第三方套件聲明整理到 `Documentation`。`npm run pack:win` 在打包後產生這些文件；`npm run pack:zip` 另製作可攜式 ZIP 與 SHA-256 檔案。

目前是候選準備，尚未發布 1.0.0。第三方聲明含 sharp Windows 原生套件的元件與授權清單，但 LGPL 對應來源及散布義務仍需正式核對。乾淨 Windows、舊資料升級、最終候選包及下載回測仍待完成。

本輪已靜態核對打包腳本路徑、12 個元件的本機授權檔、PowerShell 腳本語法、套件／lockfile 版號與四語 README 引用。執行 `node` 檢查時，自動審核因用量限制拒絕，未執行新的 `pack:win`／`pack:zip`，所以沒有宣稱 0.5.3 成品通過。舊的 0.5.2 成品不能充當新版證據。詳見 [發行準備](development/RELEASE_PREPARATION.md)。
