# 目前實作狀態：0.4.0

新增 codec、groups、batch、write-guard、project-drafts 服務，以及 ProjectDeletion 服務層（未接入口）。主程序僅接受 ID／短期 token；原生資料夾選擇後先辨識，明確確認才建立，提交前再核對設定。加密金鑰不回傳 renderer。System.json 辨識與 hash 使用同一次穩定讀取。

附加 project_codecs、groups/group_members、storage_probe、deletion_jobs 等表；原圖不重建覆寫，部署／恢復沿用既有操作日誌。group/batch/relink 與版本操作共用主程序修改鎖。儲存故障提供鎖定、寫入探測、關閉時處理。

UI 依 Mockup 重整為首頁、建立頁、工作臺、素材詳情與獨立套用／還原頁；彈窗以 portal 統一層級與鍵盤操作。建立遊戲和匯入只建立工具資料，明確套用／還原／恢復才修改遊戲。

只新增 Prettier 3.9.10 devDependency，其他套件沿用鎖定版本。完整變更與尚未完成項見 UPDATE_0.4.0.md。以下歷史記錄不代表現況。

---

# 目前實作狀態：0.3.0

新增 versions.ts（版本與整批提交）、exporter.ts（目的地預檢及逐檔結果）、operations.ts（備份、部署與恢復日誌）。新增 selections/versions/version_deletions/operations 表，既有資料保留。窄 IPC 新增版本與操作命令；main 統一阻擋並行修改與操作中正常關閉。恢復鎖以持久化 operation 狀態判定。

新 UI 沿用既有工作臺與獨立詳細／操作頁。歷史預覽與 active 分離。原型、產品規格未修改；詳見 UPDATE_0.3.0.md 的已做／未做清單。沒有聲稱 MVP 完成。

---

# 目前實作狀態：0.2.0

2026-10-22。使用者已授權以完成 MVP 為總目標持續實作，並回報 0.1.0 Windows 啟動與其餘診斷測試正常。此回報不擴大為新版或遊戲相容性通過。

本輪已接上 PROJECT/ENGINE/CATALOG 的未加密讀取子集，對應 FR-001/002/003/008/012/016/017/023/025/026 的部分行為。src/main/catalog.ts 管理原生選檔後的引擎辨識、原始檔案唯讀掃描、UUID 專屬原圖檔及 SQLite 索引；src/renderer/Workbench.tsx 提供首頁、建立彈窗、資料夾列表、搜尋、狀態篩選與原圖詳細資訊。沿用既有深色與固定頂部工具配置；未實作功能沒有假按鈕。詳細資訊採獨立頁面，返回保留搜尋與資料夾；SCREEN-004 的上傳與版本操作仍未完成，不算完整 UI 驗收。

SQLite 新增 projects/assets 表，保留原 poc_note。建案使用 canonical root 唯一鍵，MV 外層與 www 不能重複建案。來源讀取前後比對大小/時間，保存前再讀取比對 hash；備份以獨佔新檔寫入、sync、讀回 hash 驗證後登記。原圖不會因來源後續改變而更新。不得宣稱這消除了外部程式所有競態；之後套用仍須比對部署狀態。

遍歷不追蹤 symlink/junction，拒絕相對路徑穿越與工具／遊戲根重疊。不執行遊戲腳本，只讀取引擎名稱標記。壞圖及不支援素材逐筆記錄；備份或 DB 保存失敗則停止。掃描取消保留已完成項，重新啟動將 scanning 狀態標成 interrupted，不自動重掃或覆寫原圖。

原始備份預覽會再次驗證 hash。預覽讀檔與原生解碼串行，列表每頁最多 30 筆並延遲載入，避免全量原圖常駐。這只是資源控制，尚未測大型資料集或完成 worker 隔離。

尚未完成：完整版本／群組／批量操作／匯出／匯入／套用／還原／失敗恢復／加密／專案刪除與重新連結。續作將依既有內部順序處理，不再要求逐階段開發授權。新版 Windows 與真實遊戲驗收仍需使用者操作。

辨識參考：官方 [MV Utils](https://rpgmakerofficial.com/product/MV_Help/page/03_17.html)、[MZ Utils source](https://rpgmakerofficial.com/product/mz/rmmz_api/Utils.js.html)。實際部署路徑支援仍以自製 fixture 及後續真實遊戲結果為證據，不單憑參考文件宣稱相容。

---

以下為 0.1.0 歷史實作紀錄：

# POC-03 實作紀錄

版本 0.1.0；2026-10-22；產品基準 v1.0.0。

使用者已確認技術方案並授權繼續。此版本開始正式應用程式實作，但 POC-03 驗收尚未完成；沒有開始遊戲掃描或寫入。

## 模組與追蹤

| 實作 | 檔案 | 對應 | 邊界 |
|---|---|---|---|
| Electron + 窄 IPC | src/main/index.ts、src/preload/index.ts、src/shared/contracts.ts | ARCH UI/STORE、POC-03 | sandbox/contextIsolation、無 renderer Node、驗證頂層 sender/URL、拒絕新視窗/導航/權限；沒有任意路徑 IPC |
| SQLite 測試保存 | src/main/store.ts | FR-017/024 技術基礎 | migration v1、單連線、短交易、讀回 WAL/FULL/FK；只存診斷文字，並非完整專案自動保存 |
| 靜態 PNG 完整解碼 | src/main/png.ts | FR-008 部分 | signature、chunk bounds/CRC、動畫標記、Sharp raw decode、衍生預覽、原檔 hash |
| 技術診斷頁 | src/renderer | POC-03 | 沿用深色/薄荷方向，不取代 SCREEN-001～014 或修改既有設計 |
| 單元/整合測試 | tests/core.test.ts | TC-008/017/024 的基礎子集 | 不是完整 FR 通過 |

package.json 精確固定直接依賴，package-lock.json 固定解析結果。Electron 45.0.0、electron-vite 6.0.0、electron-builder 26.15.3、React 19.3.1、TypeScript 7.0.2、Vite 8.3.5、better-sqlite3 13.0.3、Sharp 0.35.5、Vitest 5.0.5。此組合只取得下述局部測試證據，不是 Windows 已驗證組合。

## 儲存與安全邊界

資料庫在 Electron userData/catalog.sqlite；僅 poc_note 診斷表與 user_version=1。沒有 project/asset/version 等正式資料表，未來 migration 不得把此診斷表當完成產品模型。來源圖片只以唯讀開啟，不複製或改寫；輸出預覽只存在記憶體。資料庫初始化/寫入錯誤回傳失敗，畫面阻擋新增編輯並提供重試。

一次只允許一個選圖/解碼請求，檔案讀取與解碼有界。Sharp 非同步像素處理由套件執行緒處理；CRC 結構掃描仍在 main。專用 worker/utility process 的隔離與卡頓量測尚待 POC-05 驗證，此處不宣稱已完成大量圖片處理設計。

32 MiB、16,777,216 像素為暫時診斷上限，會明示錯誤，不靜默縮小原檔。縮圖 1200×800 只是預覽衍生物。不支援其他格式、APNG，沒有格式轉換。

## 未完成及接續條件

- Windows 原生依賴建置、啟動、選檔、UI/IPC、退出重啟待實測；本版不附未經驗證的 exe。
- 無遊戲識別、掃描、固定原始備份、匯出、版本、差異接受、套用/還原/恢復。
- 無正式保存失敗關閉彈窗，診斷文字需按保存，不代表 FR-017/024 完成。
- POC-03 Windows 門檻通過後，下一切片 POC-04：MV/MZ 未加密遊戲唯讀掃描與固定原始基準；仍不直接套用遊戲。
- 四類私人測試遊戲由使用者備妥並手測，並未在本環境讀取或驗證。

原產品 PRD/ARCH/TEST_PLAN 以 spec-v1.0.0 原樣保存；本紀錄記載實作狀態，不更改既有需求與編號。原型及圖片僅作參考。完整 PoC 不可因本切片完成而宣稱成功。
