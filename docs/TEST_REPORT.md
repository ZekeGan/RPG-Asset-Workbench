# 0.5 核心開發驗證 — 2026-10-23

Windows x64、Node 24.13.0、npm 11.6.2、Electron 45.0.0。package 版號仍為 0.4.0，尚未發布新版本。

本輪 typecheck、5 檔 70 項自動測試、build、Electron 原生模組重建通過。隔離自製 MZ fixture 的真實 Electron main/preload/renderer IPC 通過，含回原圖、增量、離線／重連、配對獨立頁與真實 File 橋接；原生選檔使用測試替身，未測檔案總管拖放手勢或真實遊戲四格。

format:check 只有未修改的 .prettierrc.json、INTEGRATION_MANIFEST.json 格式警告，全專案格式檢查不記 PASS。完整範圍、限制及重跑步驟見 [開發記錄](DEVELOPMENT_0.5.md)；Electron 證據見 [ui-0.5.json](evidence/ui-0.5.json)。以下保留歷史結果。

# 0.4.0 驗證紀錄 — 2026-10-22

環境：Linux x86_64、Node 24.19.0；自製 PNG 與 MV/MZ fixture，未使用私人遊戲素材。

| 驗證 | 結果 | 證據／限制 |
|---|---|---|
| format:check、typecheck、build | PASS | evidence/format-check-0.4.log、typecheck-0.4.log、build-0.4.log |
| 自動測試 | PASS：5 檔、58 項 | evidence/tests-0.4.log；core、catalog、versions、manager、encryption |
| 群組／批量／重新連結 | PASS（服務層） | 多群組、跨專案拒絕、精確路徑配對、來源變動／重複目標阻擋、交易與部署內容核對 |
| MV-E／MZ-E | PASS（自製資料） | 標準 header／XOR、固定原始密文、解密匯出、批量匯入、加密套用、精確原 bytes 還原、部分寫入恢復、設定與金鑰變更拒絕 |
| 建立前辨識 | PASS（服務層） | token 單次使用、重選／取消失效、不曝露金鑰、設定變更阻擋 |
| 儲存故障／刪除 | PASS（服務層子集） | 故障鎖與探測重試；刪除二次確認／外部不變／故障重試。刪除未接 UI／IPC |
| 真正程序中斷 | PASS（Linux，自製未加密資料） | 沿用子程序 exit(77)：意圖後、第一檔後、部署提交前；重啟後明確恢復，比對 bytes |
| 建置後 renderer | PASS（mock IPC） | evidence/ui-0.4.json；Chromium 153、繁體中文字型、1440×900／1120×780／800×600 |
| Windows／原生 Electron GUI | NOT RUN | 含原生選檔、關閉確認、原生模組／打包與鎖檔 |
| 真實 MV-U／MV-E／MZ-U／MZ-E 遊戲內顯示 | NOT RUN | 自製 fixture 及工具預覽不能代替人工遊戲驗收 |

UI 實際量測：列表在三種視窗收合工具列後分別由 547→616、427→496、264→328 px，搜尋仍保留、頁面沒有水平溢出。以 elementFromPoint 檢查底部狀態列在遮罩下；Escape 關閉成功。100% 預覽寬度等於來源 400 px。套用與建立在未確認時停用；建立先顯示辨識結果，再確認進入工作臺。檢視了中文工作臺、建立及套用頁畫面；不宣稱所有 UI 狀態或逐像素驗收完成。

測試 UI 使用真實建置 renderer 搭配模擬 preload API；不能證明原生 IPC、對話框、Windows 字型或完整應用啟動通過。測試截圖僅供內部檢查，交付文字結果。0.1.0 Windows 使用者回報不延伸為本版通過。

仍待：Windows 四格遊戲矩陣、實際磁碟滿／斷電、恢復期間程序終止、專用 worker 與大量資料效能、刪除入口確認及整合。未把 58 項自動案例當成 58 項完整產品驗收。

---

# 0.3.0 驗證紀錄 — 2026-10-22

環境：Linux、Node 24.19.0、現有鎖定相依套件；自製 MV/MZ fixture，沒有私人遊戲素材。

| 驗證 | 結果 | 證據 |
|---|---|---|
| npm run typecheck | PASS | tsc --noEmit，退出碼0 |
| npm test | PASS | 3 檔、39 項；tests/core.test.ts、catalog.test.ts、versions.test.ts |
| npm run build | PASS | Electron main/preload/renderer 建置完成 |
| 匯入／版本／匯出 | PASS（子集） | 差異接受、原 bytes、重複／跨素材拒絕、DB失敗撤回、版本號、active/deployed刪除保護、匯出衝突與連結 |
| 三檔套用／還原／恢復 | PASS（Linux自製資料） | 完整套用與還原、部分套用／還原失敗、前次部署恢復、外部變更、損壞基準、恢復失敗重試 |
| 真正程序中斷 | PASS（Linux） | 子程序exit(77)：意圖後、第一檔後、部署提交前；重啟不自動寫入，確認恢復後逐檔bytes一致 |
| 本版 Electron GUI／原生對話框 | NOT RUN | 本環境沒有圖形桌面／Xvfb，僅型別與建置驗證 |
| Windows 打包／占用／新UI | NOT RUN | 需 Windows 實機 |
| MV-U/MZ-U 真實遊戲顯示 | NOT RUN | 需使用者測試副本手測 |
| MV-E/MZ-E | NOT RUN | 加密 adapter 尚未實作 |

對應 TC-007/008/009/011/014/015/017/018/019/020/021/022、TC-P04/P05/P06/P08 子集。不能將39項單元／整合測試解讀為39個完整產品驗收通過。0.1.0 Windows使用者回報不延伸為0.3.0通過。

實機限制與剩餘工作見 UPDATE_0.3.0.md。沒有新增或更新依賴版本。磁碟斷電、Windows鎖檔、實際磁碟滿與完整恢復中程序終止尚待覆蓋。

---

# 0.2.0 增量測試報告

2026-10-22；Linux x86_64 開發環境。

| 驗證 | 結果 | 證據 |
|---|---|---|
| 型別檢查 | PASS | evidence/typecheck-0.2.log |
| 自動測試 | PASS，22 項 | evidence/tests-0.2.log |
| 程式建置 | PASS | evidence/build-0.2.log |
| 0.1.0 Windows 診斷 | 使用者回報 PASS | 對話：「可以正常啟動，其餘測試也沒問題」；非本環境重測 |
| 0.2.0 Windows GUI／真實 MV/MZ 掃描 | NOT RUN | README 提供本輪手測步驟 |
| 加密／套用／還原／恢復 | NOT RUN | 尚未實作此路徑 |

12 項新增測試：MV/MZ 根目錄與 www 包裝四種 fixture、位置唯一性與外部修改後原圖固定、壞圖逐檔紀錄、未確認及加密來源拒絕、路徑穿越與 symlink 跳過、備份損壞阻擋、DB 重開及中斷狀態、多專案隔離、取消保留部分結果。

自製 PNG 與引擎標記是最小 fixture，沒有私有遊戲資料；核心腳本刻意含 throw，測試證明辨識沒有執行遊戲腳本。正向掃描逐檔比對遊戲來源與原始備份位元組；來源完全不變。測試僅覆蓋對應 FR 的子集，並非完整 MVP 通過。

剩餘風險：Windows 目錄接合/大小寫、GUI IPC/焦點、真實資料量、儲存失敗及程序級崩潰仍需擴充；本輪重啟測試是重新開啟 DB 連線並建立新 Catalog，不冒充真實 Electron 程序中斷。

---

以下為 0.1.0 歷史報告（Windows 診斷待測狀態已由上述使用者回報更新）：

# POC-03 測試報告

版本 0.1.0；2026-10-22。環境：Linux x86_64、Node 24.19.0、npm 11.9.0；Electron 45.0.0 內嵌 Node 24.22.0。

結論：程式與局部自動測試完成；**POC-03 尚未驗收通過**，Windows 建置與桌面實際操作仍待驗證。

| 檢查 | 結果 | 證據 / 限制 |
|---|---|---|
| npm run typecheck | PASS | evidence/typecheck.log |
| npm test | PASS，10 項 | evidence/tests.log；SQLite 關閉/重開連線、保存失敗、PNG 解碼與負例 |
| npm run build | PASS | evidence/build.log；產出 main/preload/renderer，不等於原生應用已可啟動 |
| npm run native:electron | PASS on Linux | better-sqlite3 完成 Electron ABI 重建 |
| Electron Node-mode 原生模組煙霧測試 | 有限通過，存在警告 | evidence/electron-native.log；SQLite 讀回與 16 bytes 像素解碼成功，SharpElectronLinux/GLib 警告，不能視為桌面穩定性通過 |
| npm run pack:win | BLOCKED | Linux 無法跨編譯 better-sqlite3 原生模組，錯誤：node-gyp does not support cross-compiling native modules from source. |
| 實際 Electron 桌面啟動 | BLOCKED | 環境為 root，Electron 拒絕無 sandbox 啟動；未關閉 sandbox 以取得假通過結果，亦無 Xvfb |
| Windows 啟動、IPC、選檔、完整程序重啟 | NOT RUN | 請依 README 手動驗收；關閉/重開 DB 連線不代表完整 GUI 重啟已測 |
| MV-U/MV-E/MZ-U/MZ-E 遊戲確認 | NOT RUN | 尚未到對應階段，未操作任何遊戲 |

自動案例：

1. SQLite Unicode 保存後，關閉連線重開讀回，驗證 WAL/FULL/FK。
2. 超長輸入拒絕；query_only 模擬保存失敗，最後已存資料不變。
3. 有透明通道的自製 8×6 PNG 完整解碼，來源檔位元組不變。
4. JPEG 改副檔名為 PNG 阻擋。
5. PNG 使用不支援副檔名阻擋。
6. 截斷及 CRC 損毀阻擋。
7–9. acTL / fcTL / fdAT 動畫區塊各自阻擋。
10. CRC 正確但壓縮像素損壞的 PNG 阻擋（避免只讀 metadata 誤通過）。

對應 FR-008/017/024 與 TC-008/017/024/TC-P09 的局部技術證據，原完整驗收案例仍維持 NOT RUN。不含磁碟滿、權限、實際斷電、IPC 攻擊、效能及完整 PNG 格式矩陣。沒有假稱完成遊戲相容性或安全恢復。

本次實作期間曾從錯誤工作目錄執行 npm install 而 ENOENT，改至專案目錄後成功；不是應用程式缺陷。依賴安裝有上游 deprecated 警告，未進行完整供應鏈稽核。沒有 lint 設定，因此不列 lint 通過。

下一步先在 Windows x64 跑安裝/建置與 README 五項手測，確認原生模組相容性；若失敗記錄原始錯誤再調整版本組合。通過前不把 POC-03 標完成，也不開始實際遊戲寫入。
