# PoC 技術方案確認與驗證紀錄

文件版本：1.0.0｜日期：2026-10-22｜對應任務：POC-02。

產品基準：PRD／ARCHITECTURE／TEST_PLAN／AGENTS v1.0.0、決策 R0.9、POC_DEVELOPMENT_PLAN_v1.0.0.md。

狀態：**Proposed Architecture 的具體化方案**。既有 Electron＋React＋Vite＋TypeScript 路線已由使用者確認；本文件新增的套件及內部設計為 Tech Lead 建議的 PoC 實作基線，尚未安裝、實測或宣稱相容。產品規則不變。本輪不初始化、不寫應用或測試程式、不操作遊戲、不改 UI。

## 1. 現況與分工更新

使用者已回報備妥 MV-U、MV-E、MZ-U、MZ-E 四類遊戲及測試圖片。現況應記為「使用者已準備，內容／場景／版本待實測」，不是「沒有樣本」，也不是「已通過驗收」。原 PoC 計畫的待準備標記是成稿當時狀態，本文件記錄其後更新；本輪不覆寫原計畫。

- 開發者／Coding Agent：實作、單元／整合／可控制故障測試、Windows 可執行建置與人工驗收步驟；沒有 Windows 時不可冒稱已建置或驗證成功。
- 使用者：在自己的 Windows 上手動操作四類遊戲，確認圖片顯示、套用與還原，提供結果／必要錯誤紀錄。
- 自動測試可使用自製最小檔案樣本，不必先取得整套私人遊戲；但不能用自製編解碼互通取代真實遊戲相容性。
- 手動測試不免除自動化完整性與故障驗證。使用者未回報的遊戲內項目維持 NOT RUN／待人工驗證。

## 2. 技術選擇總表

| ID | 項目 | 建議基線 | 未優先採用的方案與原因 | 驗證任務 |
|---|---|---|---|---|
| TECH-01 | 桌面與前端 | Electron＋React＋TypeScript，Vite | 已選路線不重開Tauri/Rust選型 | POC-03 |
| TECH-02 | 開發建置 | electron-vite；npm及lockfile | 手動維護三套main/preload/renderer建置增加配置；不並用第二套工具鏈 | POC-03 |
| TECH-03 | Windows交付 | electron-builder；先產出解壓可執行的測試包 | 先不製作安裝精靈、自動更新或正式發布流程；不使用未發布版本 | POC-03、POC-14 |
| TECH-04 | UI狀態與樣式 | React本地狀態/必要reducer、CSS Modules＋CSS變數 | PoC不先加入全域狀態框架或大型UI套件；不改既有深色方向 | POC-03、POC-07 |
| TECH-05 | 專案metadata | SQLite＋better-sqlite3，直接SQL＋明確migration | JSON全量檔不優先作事務主來源；PoC不加ORM | POC-03、POC-07、POC-09 |
| TECH-06 | 圖片/備份 | 工具專屬檔案目錄，資料庫保存索引與hash | 不把全部圖片blob放DB；PoC不做跨專案去重 | POC-04、POC-07 |
| TECH-07 | PNG檢查/縮圖 | 有邊界的PNG結構檢查＋Sharp完整解碼；原檔不重編碼 | 不只看副檔名或metadata；不自動轉格式、不支援APNG | POC-05 |
| TECH-08 | 檔案操作 | Node檔案API、SHA-256、限制範圍的服務 | 不依賴shell指令處理使用者路徑；不讓renderer任意讀寫 | POC-04、POC-08 |
| TECH-09 | 遊戲寫入/恢復 | 一個寫入協調器、逐檔備份、SQLite操作紀錄、驗證後提交 | 不以單檔rename或DB transaction宣稱整批原子 | POC-08～11 |
| TECH-10 | 引擎支援 | MV/MZ各自adapter，PNG/標準加密依真實fixture驗證 | 不執行遊戲JS來識別、不改引擎或加外掛；不泛用破解自訂格式 | POC-04、POC-12～13 |
| TECH-11 | 自動測試 | Vitest做純邏輯/檔案整合；少量Playwright Electron煙霧測試 | Playwright Electron支援標為experimental，不讓其成為唯一驗證渠道 | POC-03、POC-09～14 |
| TECH-12 | 證據與人工驗收 | 每次測試交付版本、步驟、預期、hash及錯誤摘要 | 不以UI顯示成功取代資料與遊戲結果 | POC-10～14 |

所有新增選型仍待相應任務實測。若選型失敗，先記錄實際原因，再替換內部工具；不能為了使用某套件放寬產品要求。精確依賴版本在獲准開發時核對穩定版本與互相相容性，寫入lockfile；不在未建置前指定「已驗證版本組合」。

## 3. 程序與權責邊界

### Renderer：只負責畫面與暫態交互

React顯示素材與原圖/替換圖、差異、操作進度、錯誤和確認。預覽選到的圖片與active版本分開，避免預覽變成套用選擇。持久化資料以服務回傳為準，不把localStorage當正式來源。

### Preload：窄化橋接

只提供有明確用途的命令，例如選取遊戲、掃描、匯入、匯出、套用、還原、恢復。採context isolation、renderer無Node整合、限制導航及非必要遠端載入。驗證IPC來源、參數與project/asset ID，不暴露任意路徑的讀寫／刪除API。[S1]

### Main：操作協調與唯一資料擁有者

管理視窗、選檔、專案/遊戲位置鎖、SQLite短交易、檔案操作狀態與復原。大量檔案I/O採非同步與分段hash；圖片解碼以受限併發背景工作處理，不在renderer處理原始遊戲檔。

PoC先使用單一服務擁有DB連線與逐批寫入佇列；不提前建立多個DB writer。better-sqlite3為同步API，交易須短小；若量測顯示阻塞main，將整個儲存服務移到專用worker並重新驗證，不把同一連線在程序間任意共用。[S4]

背景解碼具體使用worker或utility process，於POC-03/05依原生套件載入與失敗隔離實驗確定。worker崩潰不得被當成圖片有效或操作成功；圖片必須在遊戲寫入前完成驗證。

## 4. SQLite與檔案儲存方案

### 建議布局（邏輯規劃，不是已建立的目錄）

工具的userData位置內放catalog.sqlite及projects目錄；每個專案以不可猜測的內部ID分目錄，分別保存originals、versions、thumbnails、operations與staging。遊戲與外部匯出目錄不放在工具清理根內。

catalog.sqlite為單一索引，資料表以project_id隔離，包含project、asset、version、deployment、operation及operation_item。PoC不需要先建完整群組UI；未來群組資料仍依PRD擴充。跨專案不得共用可被單方面刪除的實體圖片。

建議啟用foreign_keys、WAL及synchronous=FULL，開啟連線後讀回設定確認。DB transaction只保證DB範圍；FULL不保證外部圖片一起落盤，也不消除裝置故障。[S5]

### 原檔與衍生檔

- 原始備份保存來源的位元組：遊戲原來是加密檔，就保存那份加密檔，不用重新加密產物當原始備份。
- 上傳的靜態PNG保存原始位元組，不透過Sharp重新輸出成另一份PNG才作替換。
- 縮圖／解密預覽屬衍生物，可重建，不作還原來源。
- 未加密原圖匯出優先直接複製；標準加密素材匯出解密後PNG。圖像處理工具只負責檢查/預覽/縮圖，不偷偷改顏色、尺寸或透明度。
- hash使用SHA-256；原檔完整性與解碼像素比較分開記錄。

### metadata與檔案提交

先把新檔寫入工具管理的暫存區、完成必要同步及hash驗證，再轉入immutable檔案位置，最後以DB短交易登記版本與active。失敗不留下可見的半個版本；程序中斷留下的暫存或孤兒檔依已知操作紀錄辨識，不掃描外部目錄清除。

完整批量匯入整批撤回屬MVP，但底層應能接受一組輸入並在一次metadata提交前完成準備，避免將來改寫保存模型。

備份檔持久化失敗或DB不能可靠記錄時不開始遊戲寫入。若DB本身無法讀取，標示保存/恢復阻塞，不憑UI快取自動繼續；如何容忍整個DB損毀屬需另評估的風險，不宣稱本PoC涵蓋所有磁碟損毀。

## 5. 靜態PNG驗證

### 驗證管線

1. 檢查內容signature與結構，不只看副檔名；限制長度、chunk邊界，拒絕不完整/矛盾輸入。
2. 檢查PNG動畫控制資訊。正常APNG有acTL；同時留意不合法出現的fcTL/fdAT，不能只讀第一影格就當靜態PNG。依PNG規格解析，不以任意位元組字串搜尋取代chunk檢查。[S7]
3. 讀取尺寸、比例與透明資訊，再做完整像素解碼。Sharp metadata讀取不解碼像素，因此不能單靠metadata判斷損毀圖片是否有效。[S6]
4. 比對固定原圖，列出差異的原值/新值；差異需使用者接受。格式或解碼錯誤不允許接受後略過。
5. 保存原檔，衍生縮圖另存。PNG中的tRNS透明資訊與alpha channel均需納入有效透明能力判斷；實際像素是否使用透明另記，不因全不透明alpha而誤判檔案無透明能力。

PNG結構檢查不是自行重寫完整解碼器。chunk解析器來源與實際函式庫要在實作時審查並測負例；Sharp等解碼器設定需採拒絕損毀的行為，不容忍截斷檔並默認成功。

大小/像素數/併發限制於實測時選定並記錄；在尚未定產品限制前不可把函式庫預設值當「所有PNG都支援」。資源限制應回報原因，不靜默縮小替換圖。

## 6. 套用、還原與恢復狀態

### 狀態名稱提案

| 狀態 | 含義 | 遊戲檔案可能已改？ |
|---|---|---|
| PREPARING | 凍結清單、預檢、準備操作前備份與新檔 | 否 |
| PREPARED | 所有備份/清單/預期hash已驗證並持久化 | 否 |
| APPLYING | 已持久化寫入意圖，逐檔寫入並驗證 | 是 |
| COMMITTED | 所有目標驗證成功，部署metadata與完成狀態同一DB交易提交 | 是，全部完成 |
| RECOVERY_REQUIRED | 有未完成操作，需要使用者確認開始恢復 | 可能 |
| RECOVERING | 正在恢復到操作前 | 可能 |
| RECOVERED | 操作前位元組與metadata已驗證 | 回到操作前 |
| RECOVERY_FAILED | 無法完成恢復 | 可能部分修改 |
| CANCELLED | 寫入前取消，遊戲未改 | 否 |

這些是內部技術名稱，不要求把英文狀態直接放入產品UI。還原也使用相同操作流程，operation kind為restore，輸出來源是固定original。

### 必要寫入次序

1. 取得本工具的操作鎖；凍結目標清單、active與原先deployed狀態。
2. 比對目前遊戲hash、可用基準、儲存狀態；有外部衝突整批阻擋。
3. 複製並驗證所有操作前檔案，保存目標新檔及before/after hash，登記PREPARED。
4. 在第一個遊戲檔案改動前，可靠記錄APPLYING。每檔寫前再次檢查；先記錄該檔寫入意圖，才改檔。
5. 同磁碟目標旁暫存檔＋替換是候選寫入策略，需Windows實測；不以「先刪原檔再寫」當預設方案。逐檔完成後核對hash與日誌。
6. 全部目標正確後，以單一DB交易更新deployed與COMMITTED。沒有提交成功不得顯示已套用成功。
7. 執行中失敗先嘗試回復；不能完成則保留RECOVERY_FAILED與備份。程序意外退出後，重啟先提示，不自動靜默寫遊戲。

### 寫檔成功但DB未提交，怎麼辦？

操作紀錄仍為APPLYING；重啟顯示未完成，使用者啟動恢復。逐一比對目標：等於before則不用重寫；等於after則可用已驗證before備份恢復；等於其他值則停止並回報可能外部變更。恢復全部驗證後才標RECOVERED，active保持操作前凍結的選用規則，deployed回到操作前。

若COMMITTED交易已成功，僅UI尚未收到回覆就退出，重啟視為已提交並重新核對實體，不因缺少UI回覆而自動回復。若實體此時不符，標示外部衝突或完整性錯誤，不能假稱正常。

恢復本身也逐檔驗證與記錄，因此再中斷後可重試。before與after都不符合的檔案，不能只因「可能是自己寫壞」就任意覆蓋；必須依經實驗驗證的寫入協議判斷可恢復狀態，否則留待處理。

### 不能忽略的限制

工具內操作鎖只能限制工具自身，不能阻止遊戲更新器或其他程式同時寫檔。預檢與再次hash仍可能有時間差；Windows檔案替換與占用行為需用TC-P08驗證。如仍有不可接受的競態，應評估額外OS層控制，不宣稱已完全杜絕外部變更。手動測試時先關閉遊戲再套用/還原，完成後重新啟動確認，亦避免舊快取影響判讀。

## 7. MV/MZ adapter 與路徑邊界

共用介面但分別驗證MV/MZ：識別資產根、列素材、讀原始位元組、轉預覽PNG、由替換PNG產生遊戲要求檔案、驗證寫後內容。保留原遊戲相對路徑與目標格式，不靠改副檔名完成加密。

PoC-04先未加密雙引擎；POC-12/13才啟動標準加密驗證。加密欄位／標頭／版本差異由合法測資和來源核對；不執行遊戲腳本取資料，不聲稱已支援自訂加密。程式內decode(encode())成功只證明互相相容，還需使用者四格真實遊戲確認。

檔案路徑由project/asset ID在服務端解析，限制在選定根及已記錄清單；相對路徑穿越、越界連結不能取得任意存取。Windows大小寫、接合點、長路徑與搬移辨識在相應任務驗證，不把文字路徑相等當同一位置的完整證明。

## 8. 原生依賴與Windows打包

electron-vite統一main/preload/renderer建置。[S2] electron-builder用於測試包；優先對照穩定版文件，避免把網站預設next版當穩定版。[S3]

better-sqlite3與Sharp的原生依賴會讓「一般Node下能用」與「Electron打包後能用」不同。依實際套件版本確認Electron ABI／Node-API相容、重建或預編譯檔取得及ASAR外部資源處理；不得把所有模組一概假設可直接使用。[S4][S8]

POC-03最早就做Windows建置煙霧測試：啟動、建立測試DB、讀寫一筆、解碼PNG、退出重啟。不能等完整UI做好才發現原生套件載入失敗。Windows CPU架構以使用者實際測試環境決定，尚未核對前不宣稱x64/ARM64皆支援。

若當前開發環境不是Windows，可先完成跨平台純邏輯測試；Windows建置/啟動仍需相應機器驗證，由開發環境或使用者回報。正式簽章、安裝精靈、自動更新不屬此PoC門檻；不得為測試包要求使用者關閉系統防護。

## 9. 自動測試與使用者手動測試

| 層級 | 執行方式 | 必要驗證 | 證據 |
|---|---|---|---|
| 純邏輯 | Vitest | 版本號、pending、差異分類、路徑/格式拒絕 | 測試結果 |
| 真實檔案整合 | Vitest＋可拋棄目錄 | DB/檔案保存、三檔寫入、故障點、恢復重入 | before/after hash、操作紀錄 |
| 程序中斷 | 子程序/測試建置的受控終止 | 真正重啟辨識，不只throw例外 | 終止點、磁碟紀錄、恢復結果 |
| Electron UI煙霧 | Playwright Electron候選 | 選檔流程承接、確認/鎖定、關閉限制 | 可重現步驟與trace；不能只測mock IPC |
| Windows真實遊戲 | 使用者手動 | 四格替換顯示、還原後顯示及重啟流程 | build ID、遊戲/引擎版本、場景、結果與必要截圖/錯誤 |

Vitest用於自動化測試；Playwright Electron在官方文件仍標示experimental，若與選定Electron組合不穩定，保持核心整合測試，UI以明確手動步驟補驗，不把未執行項目標PASS。[S9][S10]

故障注入僅在開發/測試建置可用，正常操作入口不增加「模擬失敗」產品功能。使用者不需對電腦斷電或填滿系統碟；程式中斷與硬體斷電的證據要分開，不能互相替代。

每次交付手動測試包含：可辨識版本、測試副本提醒、逐步操作、預期圖片、PASS/FAIL欄、失敗時需要的日誌。先讓使用者測一條未加密正常循環，再逐步增加還原與加密案例，不一次要求填完整故障矩陣。

## 10. 預留MVP專案刪除相容性

FR-030仍在MVP，不在PoC增加刪除UI。儲存模型現在就以project_id和專屬目錄隔離，之後能精準清理。正常歷史刪除禁止active/deployed；整個專案可經明確確認放棄還原或恢復並清理，兩者不混用。

未來刪除需確認無活動寫入worker、建立可重試清理狀態、不刪遊戲/外部/其他專案。共用catalog.sqlite只刪指定資料，不能整檔刪除；WAL/DB空間回收要另驗證，不能以SQL DELETE成功宣稱磁碟已立即縮小。這些保留於TC-D01～D05，沒有提前宣布完成。

## 11. 選型驗證與替代條件

| 門檻 | 何時驗證 | 成功條件 | 失敗時方案 |
|---|---|---|---|
| V-01 Electron/建置 | POC-03 | 開發與Windows測試包都啟動、重啟正常 | 修正electron-vite/builder設定或穩定版本組合；不改產品流程 |
| V-02 SQLite binding | POC-03/07 | 原生載入、交易/重啟、保存失敗管理可用 | 比較其他SQLite binding，包括目標Electron內建Node可用方案；驗證後再換，不靜默改JSON |
| V-03 PNG解碼/APNG | POC-05 | 正負例完整分類，損毀拒絕，原檔保持 | 調整結構驗證或更換decoder，不放寬只靜態PNG |
| V-04 跨檔恢復 | POC-09 | 多故障窗口三檔恢復精確、可重入 | 修正寫入協議；未通過禁止進真實遊戲寫入 |
| V-05 未加密四步 | POC-10/11 | MV-U/MZ-U遊戲內與恢復證據通過 | 分別修adapter/寫入/場景問題，不以另一格代替 |
| V-06 標準加密 | POC-12/13 | MV-E/MZ-E顯示、原加密檔還原、故障通過 | 停止該格，核對真實格式；不假定只改副檔名 |
| V-07 UI自動化 | POC-03/10 | 既定Electron版本可穩定執行必要煙霧 | 手動UI＋核心整合測試，明示自動化缺口 |

沒有任何門檻目前已PASS。當技術替換不改產品規則時由開發者提出具體理由並記錄；涉及支援範圍、安全語意或UI改動時回到使用者決策，不默默更改PRD。

## 12. 結論與下一步

POC-02的技術方案文件已完成；可供POC-03在獲准開發後採為候選實作基線。環境與原生依賴實驗尚未執行，因此不能稱POC-02所有技術風險已解決。

本次收斂：electron-vite開發建置、electron-builder測試包、SQLite/better-sqlite3 metadata、檔案圖片庫、Sharp＋PNG結構檢查、受限IPC、逐檔備份與操作紀錄、Vitest與少量Playwright候選。四種測試遊戲及圖片已由使用者準備，實際遊戲驗證由使用者手動執行。

下一個可執行任務：POC-03最小骨架與依賴載入驗證；先核對Windows執行環境，再在使用者授權後初始化。第一個交付目標只是「桌面程式可開、DB能保存、靜態PNG能解碼、可重啟」，不開始遊戲寫入。是否寫入遊戲仍依POC-08/09門檻控制。

## 13. 官方技術來源

查閱日期：2026-10-22。下列來源用於核對技術能力；它們不代表本專案已測試通過。

- S1 [Electron Security](https://www.electronjs.org/docs/latest/tutorial/security)：隔離、窄IPC與來源驗證。
- S2 [electron-vite Getting Started](https://electron-vite.org/guide/)：main/preload/renderer建置。
- S3 [electron-builder穩定版文件入口](https://www.electron.build/v26/)：測試包；當時首頁指出next版本尚未發布，開發時再次核對穩定版。
- S4 [better-sqlite3官方專案](https://github.com/WiseLibs/better-sqlite3)：同步API及交易能力。
- S5 [SQLite PRAGMA synchronous](https://www.sqlite.org/pragma.html#pragma_synchronous)：WAL/FULL持久化選擇。
- S6 [Sharp Input metadata](https://sharp.pixelplumbing.com/api-input/)：metadata不等於像素解碼。
- S7 [W3C PNG Third Edition](https://www.w3.org/TR/png-3/)：PNG/APNG chunk結構依據。
- S8 [Electron Native Node Modules](https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules)：原生依賴相容與重建。
- S9 [Vitest Guide](https://vitest.dev/guide/)：自動化測試候選。
- S10 [Playwright Electron API](https://playwright.dev/docs/api/class-electron)：Electron實驗性自動化支援。
