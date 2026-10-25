# GitHub Release 草稿（尚未發布）

以下是發行流程模板；**不要把 0.5.3 候選包標成 1.0.0**。先完成 [發行門檻](RELEASE_PREPARATION.md)，對最終定版的 commit 建置與驗收。

## 擬定說明

RPG Asset Workbench 1.0.0 是 Windows x64 的 RPG Maker MV／MZ 圖片素材工作臺。支援保存固定原圖、替換版本、群組、批量配對、明確確認後套用與還原、四語介面。下載可攜式 ZIP，完整解壓後執行 `RPG Asset Workbench.exe`；無需另行安裝 Node.js。請在操作前備份遊戲，詳閱 ZIP 中 `Documentation/README.md` 與永久刪除提示。

已知限制：只接受靜態 PNG、單檔 32 MiB；一般像素上限 16,777,216，經確認的替換／批量匯入硬上限 33,554,432。自訂加密與非 Windows x64 未保證相容。若發行包未簽章，Windows 可能顯示未驗證發布者提示；不應要求使用者停用安全防護。

正式發布前以最終測試結果改寫上述說明，記錄已驗證的 Windows／引擎版本、升級情況、SHA-256 與未解決問題。

## 使用者手動操作（最終版號確認後）

確保工作目錄乾淨、目前 commit 就是已驗收的 `1.0.0`；確認 `package.json`、lockfile、四語 README、ZIP 名稱一致。使用者可依序執行：

```powershell
git status
git add AGENTS.md README.md START_HERE.md LICENSE docs package.json package-lock.json resources scripts src tests
git commit -m "release: prepare RPG Asset Workbench 1.0.0"
git tag -a v1.0.0 -m "RPG Asset Workbench 1.0.0"
git push origin HEAD
git push origin v1.0.0
```

若最終候選的修改已在前一個 commit，應先確認該 commit 與包完全一致，再直接建標籤，不要為模板再製造多餘 commit。若遠端分支、保護規則或權限不同，以實際倉庫設定調整。

在 GitHub 網頁的 **Releases → Draft a new release** 選 `v1.0.0`，填入上述經核實的說明，上傳 ZIP 與對應 `.sha256`，檢查附件與發布範圍後按 **Publish release**。也可在已安裝且登入的 GitHub CLI 中使用：

```powershell
gh release create v1.0.0 release/RPG-Asset-Workbench-1.0.0-win-x64.zip release/RPG-Asset-Workbench-1.0.0-win-x64.zip.sha256 --title "RPG Asset Workbench 1.0.0" --notes-file docs/development/RELEASE_NOTES_FINAL.md
```

`RELEASE_NOTES_FINAL.md` 須先根據最終驗收建立。發布後從 Release 頁重新下載 ZIP，驗證 SHA-256 與基本啟動。以上指令是操作草稿，本輪未執行 Git 寫入或發布。
