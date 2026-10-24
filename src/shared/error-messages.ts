const rows = String.raw`
拒絕未授權的操作來源|Unauthorized operation source|許可されていない操作元です
另有操作正在執行，請稍候|Another operation is running. Please wait.|別の操作を実行中です。お待ちください。
操作失敗|Operation failed|操作に失敗しました
專案 ID 無效|Invalid project ID|プロジェクト ID が無効です
參數無效|Invalid parameters|パラメーターが無効です
建立專案參數不合法|Invalid project creation parameters|プロジェクト作成のパラメーターが無効です
請先確認未修改來源|Confirm that the source is unmodified first|元データが未変更であることを確認してください
詳細頁只接受一張圖片|Only one image is accepted here|ここでは画像を1枚だけ受け付けます
素材 ID 無效|Invalid asset ID|素材 ID が無効です
靜態 PNG|Static PNG|静止 PNG
匯入預覽已過期，請重新選圖|Import preview expired. Choose the image again.|インポートのプレビューが期限切れです。画像を選び直してください。
匯出參數無效|Invalid export parameters|エクスポートのパラメーターが無効です
{0} 個同名檔案|{0} files with matching names|同名ファイルが {0} 件あります
略過同名|Skip matching names|同名ファイルをスキップ
覆蓋清單中的同名檔|Overwrite listed matching files|一覧の同名ファイルを上書き
請確認操作清單|Confirm the operation list|操作一覧を確認してください
請確認恢復|Confirm recovery|復旧を確認してください
專案不存在|Project does not exist|プロジェクトが存在しません
素材不屬於此專案|Asset does not belong to this project|このプロジェクトの素材ではありません
封面預覽已過期，請重新選圖|Cover preview expired. Choose the image again.|カバープレビューが期限切れです。画像を選び直してください。
封面參數無效|Invalid cover parameters|カバーのパラメーターが無効です
刪除參數無效|Invalid deletion parameters|削除のパラメーターが無効です
選擇匯入資料夾（內含 img 相對路徑可自動配對）|Choose import folder (img relative paths support automatic matching)|インポートフォルダーを選択（img の相対パスで自動照合できます）
拖放參數無效|Invalid dropped files|ドロップされたファイルが無効です
請等候目前操作結束|Wait for the current operation to finish|現在の操作が完了するまでお待ちください
正在檢查圖片，請稍候|Checking image. Please wait.|画像を検証中です。お待ちください。
檔案非一般檔案，或超過 PoC 32 MiB 上限|Not a regular file, or exceeds the 32 MiB limit|通常のファイルではないか、32 MiB の上限を超えています
操作尚未完成，請等待保存或恢復結束再關閉。|Wait for saving or recovery to finish before closing.|保存または復旧が完了してから閉じてください。
儲存失敗尚未解除|Storage failure has not been resolved|保存エラーが解消されていません
重試儲存檢查，或放棄尚未保存的暫存輸入並關閉。未完成遊戲操作紀錄仍保留，關閉不代表已恢復。|Retry the storage check, or discard unsaved input and close. Unfinished game operations remain recorded; closing does not recover them.|保存先の検証を再試行するか、未保存の入力を破棄して閉じてください。未完了のゲーム操作は記録に残り、閉じても復旧は行われません。
重試|Retry|再試行
放棄未儲存變更並關閉|Discard unsaved changes and close|未保存の変更を破棄して閉じる
單批最多 2000 張，請分批匯入|Maximum 2,000 images per batch. Split the import.|1回につき最大2,000枚です。分けてインポートしてください。
請提供 1–2000 張圖片|Provide 1–2,000 images|画像を1～2,000枚指定してください
批次已過期|Batch expired|バッチが期限切れです
此圖片未通過匯入檢查，請重新選擇|This image failed validation. Choose it again.|画像の検証に失敗しました。選び直してください。
來源自預檢後已改變，請重新載入|Source changed after validation. Reload it.|検証後に元データが変更されました。再読み込みしてください。
跨專案配對遭拒|Cross-project matching is blocked|プロジェクトをまたぐ照合は禁止されています
批次清單無效|Invalid batch list|バッチ一覧が無効です
來源重複|Duplicate source|元データが重複しています
配對無效|Invalid match|照合が無効です
單批圖片總量超過 128 MiB，請分批|Batch exceeds 128 MiB. Split the import.|バッチが128 MiBを超えています。分けてインポートしてください。
不合法的相對路徑|Invalid relative path|相対パスが無効です
不讀取連結或接合點|Links and junctions are not read|リンクとジャンクションは読み取りません
路徑超出專案範圍|Path is outside the project|パスがプロジェクトの範囲外です
檔案非一般檔案，或超過大小限制|Not a regular file, or exceeds the size limit|通常のファイルではないか、サイズ上限を超えています
讀取期間檔案變更，請關閉其他修改程式|File changed during reading. Close other editing programs.|読み取り中にファイルが変更されました。他の編集プログラムを閉じてください。
金鑰|key|キー
找到多個引擎位置，請直接選擇正確的素材根目錄|Multiple engine locations found. Select the correct asset root directly.|エンジンの場所が複数あります。正しい素材のルートフォルダーを選択してください。
無法辨識標準 MV／MZ 遊戲；需要 data/System.json、核心腳本及 img 資料夾|Cannot detect a standard MV/MZ game. Requires data/System.json, a core script and an img folder.|標準の MV/MZ ゲームを検出できません。data/System.json、コアスクリプト、img フォルダーが必要です。
找不到專案|Project not found|プロジェクトが見つかりません
已有掃描正在執行|A scan is already running|スキャンを実行中です
請先確認來源為未修改的測試副本|Confirm that the source is an unmodified test copy|元データが未変更のテスト用コピーであることを確認してください
專案名稱最多 100 字|Project names may contain at most 100 characters|プロジェクト名は100文字以内で入力してください
辨識遊戲…|Detecting game…|ゲームを検出中…
遊戲位置與工具資料目錄不可重疊|Game and tool data folders must not overlap|ゲームとツールのデータフォルダーは重複できません
這個遊戲位置已有專案，請開啟原專案|A project already uses this game location. Open that project.|このゲームの場所には既存のプロジェクトがあります。そちらを開いてください。
跳過符號連結／接合點|Skipped symbolic link / junction|シンボリックリンク／ジャンクションをスキップ
加密副檔名與引擎不符|Encrypted extension does not match the engine|暗号化ファイルの拡張子がエンジンと一致しません
掃描時來源變更，未建立基準|Source changed during scanning; no baseline created|スキャン中に元データが変更されたため、基準を作成しませんでした
原始備份驗證失敗|Original backup verification failed|元画像のバックアップ検証に失敗しました
遊戲引擎或加密設定與原專案不一致|Engine or encryption settings differ from the original project|エンジンまたは暗号化設定が元のプロジェクトと一致しません
遊戲設定自建立後已變更，禁止寫入|Game settings changed after project creation; writing is blocked|作成後にゲーム設定が変更されたため、書き込みを禁止しています
找不到或無法驗證遊戲資料夾，請重新連結遊戲位置。|Game folder is missing or cannot be verified. Relink the game location.|ゲームフォルダーが見つからないか検証できません。場所を再リンクしてください。
來源含連結：|Source contains a link:|元データにリンクが含まれています：
素材沒有可驗證基準：|Asset has no verifiable baseline:|検証可能な基準がない素材です：
原始備份損壞：|Original backup is damaged:|元のバックアップが破損しています：
部署紀錄不完整|Deployment record is incomplete|適用履歴が不完全です
版本備份損壞|Version backup is damaged|バージョンのバックアップが破損しています
掃描確認已過期|Scan confirmation expired|スキャン確認が期限切れです
已保存素材與來源不一致，不能續掃；基準保持不變|Saved assets differ from the source. Cannot resume; baselines are unchanged.|保存済み素材と元データが一致しないため再開できません。基準は変更しません。
核對來源…|Checking source…|元データを確認中…
來源清單已變更，請重新掃描確認|Source list changed. Scan and confirm again.|元データの一覧が変更されました。再スキャンして確認してください。
來源已變更，請重新確認：|Source changed; confirm again:|元データが変更されました。再確認してください：
新增來源已變更：|New source changed:|追加の元データが変更されました：
掃描中不可重新連結|Cannot relink while scanning|スキャン中は再リンクできません
引擎與原專案不一致|Engine differs from the original project|エンジンが元のプロジェクトと一致しません
遊戲設定與原專案不一致|Game settings differ from the original project|ゲーム設定が元のプロジェクトと一致しません
不可連結到工具資料位置|Cannot link to the tool data location|ツールのデータフォルダーにはリンクできません
此位置已有其他專案|Another project uses this location|別のプロジェクトがこの場所を使用しています
專案掃描不完整，無法安全重新連結|Project scan is incomplete; cannot safely relink|スキャンが不完全なため、安全に再リンクできません
新位置含連結|New location contains links|新しい場所にリンクが含まれています
素材路徑清單與原專案不一致。缺少：|Asset paths differ from the original project. Missing:|素材のパス一覧が元のプロジェクトと一致しません。不足：
無|None|なし
；新增：|; added:|；追加：
素材內容不一致：|Asset content differs:|素材の内容が一致しません：
素材沒有可用的原始基準|Asset has no valid original baseline|有効な元画像の基準がありません
原始備份損壞，禁止使用|Original backup is damaged and cannot be used|元のバックアップが破損しているため使用できません
標準加密金鑰無效|Invalid standard encryption key|標準暗号化キーが無効です
加密圖片缺少專案金鑰|Encrypted image has no project key|暗号化画像のプロジェクトキーがありません
不支援的加密標頭|Unsupported encryption header|未対応の暗号化ヘッダーです
刪除正在進行|Deletion in progress|削除中です
需要確認永久刪除專案|Confirm permanent project deletion|プロジェクトの完全削除を確認してください
需再次確認保留遊戲現況並永久放棄還原／恢復能力|Confirm keeping the game as-is and permanently giving up restore and recovery|ゲームの現状を保持し、復元・復旧機能を完全に放棄することを再確認してください
專案目錄識別無效|Invalid project directory identity|プロジェクトディレクトリの識別情報が無効です
專案資料含連結，停止清理|Project data contains links; cleanup stopped|プロジェクトデータにリンクが含まれるため削除を停止しました
匯出路徑不合法|Invalid export path|エクスポート先パスが無効です
目的地含符號連結／接合點|Destination contains a symbolic link or junction|保存先にシンボリックリンクまたはジャンクションが含まれています
目的地不是資料夾|Destination is not a folder|保存先がフォルダーではありません
目的地不是一般檔案|Destination is not a regular file|保存先が通常のファイルではありません
匯出選擇無效|Invalid export selection|エクスポート対象が無効です
匯出位置不可與遊戲或工具資料重疊|Export destination must not overlap game or tool data|エクスポート先はゲームやツールのデータと重複できません
匯出路徑重複，請分開專案匯出|Duplicate export paths. Export projects separately.|エクスポート先パスが重複しています。プロジェクトごとに書き出してください。
預檢後出現同名檔案，未授權覆蓋|A matching file appeared after validation; overwrite not authorized|検証後に同名ファイルが作成されました。上書きは許可されていません。
匯出後驗證失敗|Export verification failed|エクスポート後の検証に失敗しました
群組名稱需為 1–80 字|Group name must be 1–80 characters|グループ名は1～80文字で入力してください
群組不屬於此專案|Group does not belong to this project|このプロジェクトのグループではありません
群組參數無效|Invalid group parameters|グループのパラメーターが無効です
專案刪除未完成，請返回首頁重試刪除|Project cleanup is incomplete. Retry deletion from the home page.|プロジェクトの削除が未完了です。一覧から再試行してください。
專案有未完成操作，請先恢復|Project has an unfinished operation. Recover it first.|未完了の操作があります。先に復旧してください。
備份寫入驗證失敗|Backup write verification failed|バックアップ書き込みの検証に失敗しました
偵測外部變更，禁止覆蓋|External change detected; overwrite blocked|外部変更を検出したため、上書きを禁止しました
寫入前偵測外部變更|External change detected before writing|書き込み前に外部変更を検出しました
寫入後驗證失敗|Post-write verification failed|書き込み後の検証に失敗しました
操作類型無效|Invalid operation type|操作の種類が無効です
掃描尚未完成，請先繼續掃描；目前無法套用到遊戲|Scan incomplete. Resume scanning before applying to the game.|スキャンが未完了です。ゲームに適用する前にスキャンを再開してください。
沒有可操作項目或選擇重複|No eligible items or duplicate selection|操作できる項目がないか、選択が重複しています
跨專案操作遭拒|Cross-project operation blocked|プロジェクトをまたぐ操作は禁止されています
素材沒有已部署替換|Asset has no deployed replacement|素材に適用済みの置換画像がありません
遊戲檔案已被外部修改：|Game file was modified externally:|ゲームファイルが外部で変更されています：
操作失敗且恢復未完成：|Operation failed and recovery is incomplete:|操作に失敗し、復旧も未完了です：
正在寫入|Writing in progress|書き込み中です
專案刪除未完成，禁止恢復；請返回首頁重試刪除|Project deletion is incomplete; recovery blocked. Retry deletion from home.|プロジェクトの削除が未完了のため復旧は禁止されています。一覧から削除を再試行してください。
操作無需恢復|Operation does not need recovery|この操作に復旧は不要です
操作前備份損壞|Pre-operation backup is damaged|操作前のバックアップが破損しています
恢復遭外部變更阻擋：|Recovery blocked by external changes:|外部変更により復旧できません：
圖片 {0} × {1} 超過安全上限 {2} 像素|Image {0} × {1} exceeds the hard limit of {2} pixels|画像 {0} × {1} は安全上限の {2} ピクセルを超えています
超過本次 PoC 32 MiB 檢查上限|Exceeds the 32 MiB file limit|ファイルの上限32 MiBを超えています
只能使用靜態 PNG，檔案內容不是 PNG|Only static PNG is supported; this file is not PNG|静止 PNG のみ対応しています。このファイルの内容は PNG ではありません
PNG 區塊截斷|Truncated PNG chunk|PNG チャンクが途中で切れています
PNG 區塊長度錯誤|Invalid PNG chunk length|PNG チャンクの長さが不正です
PNG 區塊名稱錯誤|Invalid PNG chunk name|PNG チャンク名が不正です
不支援 APNG 動態圖片|Animated APNG is not supported|アニメーション APNG には対応していません
PNG CRC 損毀|PNG CRC mismatch|PNG の CRC が一致しません
PNG 缺少有效 IHDR|PNG has no valid IHDR|PNG に有効な IHDR がありません
PNG 重複 IHDR|Duplicate PNG IHDR|PNG の IHDR が重複しています
PNG 結尾錯誤|Invalid PNG ending|PNG の終端が不正です
PNG 不完整|Incomplete PNG|PNG が不完全です
只接受 .png 圖片，其他格式不能匯入|Only .png images can be imported|インポートできるのは .png 画像のみです
圖片 {0} × {1} 超過一般上限 {2} 像素，需確認大圖處理|Image {0} × {1} exceeds the regular limit of {2} pixels; large-image confirmation required|画像 {0} × {1} は通常上限の {2} ピクセルを超えています。大きな画像の処理を確認してください
遊戲辨識已過期，請重新選擇資料夾|Game detection expired. Choose the folder again.|ゲーム検出が期限切れです。フォルダーを選び直してください。
遊戲設定已變更，請重新選擇資料夾|Game settings changed. Choose the folder again.|ゲーム設定が変更されました。フォルダーを選び直してください。
專案封面.png|Project cover.png|プロジェクトカバー.png
另有操作正在執行|Another operation is running|別の操作を実行中です
專案名稱需為 1–80 字|Project name must be 1–80 characters|プロジェクト名は1～80文字で入力してください
封面保存驗證失敗|Cover save verification failed|カバー保存の検証に失敗しました
請確認永久刪除與失去還原能力|Confirm permanent deletion and loss of restore capability|完全削除と復元機能の喪失を確認してください
請等候目前操作安全結束|Wait for the current operation to finish safely|現在の操作が安全に完了するまでお待ちください
此專案有未完成恢復，必須明確確認放棄恢復|Recovery is unfinished; explicitly confirm abandoning recovery|復旧が未完了です。復旧を放棄することを明示的に確認してください
清理範圍包含連結或接合點，禁止刪除|Cleanup includes a link or junction; deletion blocked|削除範囲にリンクまたはジャンクションがあるため、削除を禁止しました
清理範圍與遊戲位置重疊，禁止刪除|Cleanup overlaps a game location; deletion blocked|削除範囲がゲームの場所と重複するため、削除を禁止しました
SQLite 設定驗證失敗|SQLite configuration verification failed|SQLite 設定の検証に失敗しました
資料庫版本較新，請使用相符版本的工具|Database version is newer. Use a compatible tool version.|データベースのバージョンが新しすぎます。対応するツールを使用してください。
測試文字最多 2000 字|Test text must not exceed 2,000 characters|テスト文字列は2,000文字以内で入力してください
沒有可用的原始基準|No valid original baseline|有効な元画像の基準がありません
尺寸：{0} × {1} → {2} × {3}|Dimensions: {0} × {1} → {2} × {3}|サイズ：{0} × {1} → {2} × {3}
比例：{0}:{1} → {2}:{3}|Aspect ratio: {0}:{1} → {2}:{3}|縦横比：{0}:{1} → {2}:{3}
透明通道：{0} → {1}|Alpha channel: {0} → {1}|アルファチャンネル：{0} → {1}
有|Yes|あり
版本正在保存|Version is being saved|バージョンを保存中です
空批次或重複目標|Empty batch or duplicate targets|バッチが空か、対象が重複しています
必須接受圖片差異|Image differences must be accepted|画像の差異を承認してください
版本檔案驗證失敗|Version file verification failed|バージョンファイルの検証に失敗しました
版本不屬於此素材|Version does not belong to this asset|この素材のバージョンではありません
圖片備份損壞，禁止使用|Image backup is damaged and cannot be used|画像のバックアップが破損しているため使用できません
原始備份損壞|Original backup is damaged|元画像のバックアップが破損しています
此版本刪除尚未完成，請重試刪除|Version deletion is incomplete. Retry deletion.|バージョンの削除が未完了です。再試行してください。
不可刪除目前選用或已部署版本|Cannot delete a selected or deployed version|選択中または適用済みのバージョンは削除できません
版本不存在|Version does not exist|バージョンが存在しません
上次儲存失敗|Previous save failed|前回の保存に失敗しました
儲存故障紀錄無法讀取|Cannot read storage failure record|保存エラーの記録を読み取れません
儲存故障：請先重試儲存檢查。|Storage failure: retry the storage check first.|保存エラー：先に保存先の検証を再試行してください。
資料庫完整性檢查失敗|Database integrity check failed|データベースの整合性検証に失敗しました
`;
export const errorMessages: Record<string, [string, string]> = Object.fromEntries(
  rows
    .trim()
    .split('\n')
    .map((line) => {
      const [key, en, ja] = line.split('|').map((s) => s.replaceAll('\\n', '\n'));
      return [key, [en, ja]];
    }),
);
