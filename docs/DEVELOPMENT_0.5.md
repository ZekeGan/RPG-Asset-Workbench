# 0.5 核心開發記錄

2026-10-23：使用者同意核心範圍開發並要求繼續未完成部分。保留 npm；不提交、推送、發布或寫入真實遊戲。本檔記錄開發進度，交接包及其 manifest 保留為歷史基準。

範圍：H-B05 回原圖、H-B07 續掃、H-B17/18 離線與重連、H-B19 增量掃描、H-B03/12/16 拖放及批量配對。其餘待辦未列為本版必要交付。

產品更新：active=null 代表選回固定原圖；active 與 deployed 不同即待套用，仍須明確確認才寫入。批量配對完整相對路徑優先，其次全專案唯一檔名，多候選不猜配。掃描取消保留成果，未完成禁止套用。離線仍可檢視保存資料，寫入前必須再次驗證來源。增量只追加確認的新路徑，既有變更與缺失不覆寫／刪除基準。

驗收：成功回原圖、非目標不變、歷史保留、外部衝突阻擋、部分寫入及提交失敗恢復操作前 bytes；掃描取消／重啟續掃、增量確認與來源變動；完整搬移／錯誤副本；首次配對、多候選、拖放限制及返回不提交。Windows 真實遊戲四格需另附實測結果，不沿用歷史 PASS。

## 本輪實作

- H-B05：主程序、工作臺待套用篩選／列狀態、詳細頁、套用比較頁一致識別 V1→原圖。保留歷史，沿用原 bytes、外部衝突與操作前恢復。
- H-B07/19：一次性掃描確認 token，分列新增、既有變更與缺失。提交前核對清單與 hash；僅新增路徑建立備份。首次掃描取消後可續掃，重啟保留；未完成禁止套用。
- H-B17/18：開啟及定時核對位置，離線持續提示並停用遊戲寫入；重新連結核對全部已保存基準／部署內容，允許未掃描的新路徑留待確認新增，缺少／新增差異列出。未猜測使用者先前錯誤的唯一根因。
- H-B03/12/16：批量配對為保留側欄的獨立頁；初次載入即配對，完整相對路徑優先、唯一同名 fallback，多候選不猜配。工作臺／配對頁可多圖拖入，詳細頁只接受單圖；差異確認及原子提交沿用既有服務。名稱比對採 NFC 與不分大小寫，碰撞時不自動選擇。
- 沒有改依賴版本或 package 版號；沒有提交、推送或發布。原交接 manifest 不重寫，作為 0.4 整合包的歷史基準。

## 實際驗證

Windows x64，Node 24.13.0、npm 11.6.2、Electron 45.0.0；全部資料為自製 fixture。

| 檢查 | 結果與範圍 |
|---|---|
| TypeScript | PASS，npm run typecheck |
| 全專案格式檢查 | 未全過：npm run format:check 只警告原有 .prettierrc.json、INTEGRATION_MANIFEST.json，兩檔 git diff 為空；本輪來源／測試沒有格式警告，不改寫歷史 manifest |
| 自動測試 | PASS，5 檔 70 項；包含真正取消後重新建立 Catalog 續掃、回原圖部分寫入／提交故障、加密原 bytes、外部衝突及新增不覆寫 |
| 建置 | PASS，main/preload/renderer |
| Electron 原生重建 | PASS，better-sqlite3 |
| Windows Electron fixture smoke | PASS，真實 main/preload/renderer IPC；建案、回原圖、增量、離線及重連；原生選檔對話框由測試替身提供來源 |
| File 橋接 | PASS，CDP 載入實際本機 File 後經 preload 單圖匯入與批量預檢；詳細頁多圖拒絕。尚未驗證 Windows 檔案總管的實際拖放手勢 |
| UI | 1120×780、800×600 無整頁水平溢出；批量獨立頁、套用確認阻擋；實際開啟截圖檢查，未宣稱全畫面／所有狀態 Mockup 驗收完成 |

Electron 驗證程式：tests/electron-smoke.cjs；證據：docs/evidence/ui-0.5.json、ui-0.5-original.png、ui-0.5-batch-1120.png、ui-0.5-batch-800.png。測試建立 out/qa-* 隔離 userData 與遊戲，不使用使用者既有工具資料。

重跑 Electron smoke 前需 npm run build、npm run native:electron，並在該程序清除 ELECTRON_RUN_AS_NODE，再執行 node node_modules/electron/cli.js tests/electron-smoke.cjs。回到 Node 測試前先 npm run native:node。

結束時原生模組維持 Electron ABI，可使用 npm run dev 啟動。尚未執行 pack:win，未提供已驗收執行檔。

## 尚待驗收與明確限制

- 真實 MV-U/MV-E/MZ-U/MZ-E 遊戲內顯示、原生對話框／檔案總管拖放、Windows 打包、真實磁碟滿與斷電仍未驗收。
- 遊戲 System.json 或加密設定變更仍安全阻擋，沒有擅自接納新身分或重建原圖；本輪增量支援設定一致時的新增素材。
- 沒有任何有效基準、或含無基準錯誤素材的專案仍不能安全重新連結；不跳過已保存基準驗證。續掃遇既有變更／缺失會阻擋，不自動修復或重建。
- 專用 worker、大量資料效能、三語及其他便利功能不在本輪完成宣告內。OPEN-005 與快捷刪除語意維持未決。
