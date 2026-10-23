# 基準實作與測試狀態

截至交接前的0.4.0工作區；非使用者本機即時狀態。本次只讀核對現有檔案，沒有重新跑應用測試或建置。

## 已有實作

| 模組 | 基準能力 | 邊界 |
|---|---|---|
| catalog / project-drafts | 原生選資料夾辨識 MV/MZ、先預覽再確認、固定原始 bytes 備份、取消保留部分掃描、多專案、重新連結 | 無續掃／增量入口；連結有使用者回報問題 |
| codec | MV/MZ 標準圖片加解密、解密預覽／匯出、按引擎加密套用 | 不支持自訂加密；原密文不變 |
| versions | 匯入 PNG、差異確認、不可變版本、active/deployed、選版本／刪除保護、100%預覽 | 切回原圖後待套用漏項；詳見 backlog |
| groups / batch | 多群組關聯、批量配對與原子版本提交 | 群組內選素材入口不足；批量小視窗不符稿；只有精確相對路徑配對 |
| exporter | 保留相對路徑、衝突處理、逐檔結果、保護遊戲／工具目錄 | 原生選檔和 Windows 待測 |
| operations | 套用／還原／恢復、寫入前備份、外部變更阻擋、持久日誌、重啟鎖 | 新回原圖流程漏項；真實遊戲四格未全驗 |
| write-guard | 部分儲存錯誤鎖定、磁碟／DB寫入探測、關閉處理 | 真實磁碟滿／Windows 原生流程未驗 |
| deletion | 專案清理、雙確認、故障紀錄與重試服務 | 未接 UI／IPC，不是可用產品功能 |
| renderer | 首頁、建立頁、工作臺、詳細與操作頁、portal modal、頂部工具列收合 | 使用者回報的 Mockup 差異未修；不是完整 UI 驗收 |
| DX | Prettier 3.9.10 精確 devDependency、VS Code 儲存格式化、format/check | 開啟檔案不自動改寫；擴充需使用者安裝 |

## 既有證據

| 檢查 | 原結果 | 本包證據 |
|---|---|---|
| npm run format:check | PASS | evidence/format-check-0.4.log |
| npm run typecheck | PASS | evidence/typecheck-0.4.log |
| npm test | PASS：5 files、58 tests | evidence/tests-0.4.log |
| npm run build | PASS | evidence/build-0.4.log |
| Chromium renderer／mock IPC | PASS（局部） | evidence/ui-0.4.json |
| Windows 0.1 啟動與診斷 | 使用者曾回報通過 | 歷史回報，不延伸為0.4全部通過 |
| Windows 0.4 | 有使用者實際問題回報，完整矩陣未完成 | BACKLOG；不把未回報項當通過 |

自動案例含 core/catalog/versions/manager/encryption；群組隔離、批量來源變動／重複目標、版本交易、加密套用／原 bytes 還原、服務層故障恢復、建立 token 失效等。真正程序 exit(77) 測了未加密 fixture 的意圖後／首檔後／提交前中斷；不能泛稱所有加密／恢復中斷已測。

UI 三種尺寸 1440×900、1120×780、800×600 收合頂部工具列，列表高度分別547→616、427→496、264→328px；搜尋保留、無頁面水平溢出、遮罩蓋過 footer、Escape 關閉、100%來源400px、建立與套用確認按鈕阻擋。測試用真實編譯 renderer＋模擬 IPC，不是 Electron 桌面整合。

## 未測／未完成

- Windows 原生視窗、對話框、關閉故障流程、打包 exe、鎖檔。
- 真實 MV-U/MV-E/MZ-U/MZ-E 遊戲內套用與還原四格完整驗收。
- 使用者新增需求的修復測試、所有 Mockup／三語／長文字／拖放狀態驗收。
- 實際斷電、磁碟滿、恢復期間程序終止；大量資料和 worker 隔離。
- Linux 跨編 Windows better-sqlite3 曾受阻，不附已驗證 Windows 執行檔。

## 將來授權後的指令（本輪未執行）

先讀本機 package.json，不盲目升級。已記錄 Node 24.19.0。Node 測試與 Electron 使用不同原生 ABI：

```powershell
npm ci
npm run native:node
npm run format:check
npm run typecheck
npm test
npm run build
# 需要啟動桌面時才執行：
node node_modules/electron/install.js
npm run native:electron
npm run dev
```

切回測試先 native:node。pack:win 要在適合的 Windows 環境驗證。format 會修改程式碼，本輪不能執行。現無 lint script，不能聲稱 lint 通過。

既有暫時上限：靜態PNG單檔32MiB／16,777,216像素；批量2000檔／提交暫存128MiB；列表每頁30筆。超限應明確提示，非暗中轉檔或縮原圖。

原日誌與文件日期保留原樣（部分標2026-10-22，為執行環境紀錄）；交接日期採使用者時區2026-10-23。沒有把舊測試包裝為今日重跑。
