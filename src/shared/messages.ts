// Source-language keys remain stable; placeholders never translate user-supplied names or paths.
import simplifiedCharacters from './simplified-characters.json';
const chars = new Map(Object.entries(simplifiedCharacters));
export function simplify(text: string) {
  return text
    .replaceAll('資料夾', '文件夹')
    .replaceAll('資料', '数据')
    .replaceAll('自訂', '自定义')
    .replaceAll('專案', '项目')
    .replaceAll('檔案', '文件')
    .replaceAll('匯入', '导入')
    .replaceAll('匯出', '导出')
    .replaceAll('套用', '应用')
    .replaceAll('程式', '程序')
    .replaceAll('滑鼠', '鼠标')
    .replaceAll('透明通道', '透明通道')
    .replaceAll('重新整理', '刷新')
    .replaceAll('記憶體', '内存')
    .replaceAll('資訊', '信息')
    .replaceAll('訊息', '消息')
    .split('')
    .map((c) => chars.get(c) ?? c)
    .join('');
}
const rows = String.raw`
批量匯入與配對|Batch import and matching|一括インポートと照合
拖入圖片，或選擇圖片資料夾。完整相對路徑優先，其次全專案唯一檔名；多個候選請手動指定。只接受靜態 PNG。|Drop images or choose a folder. Match full relative paths first, then filenames unique to this project. Select ambiguous matches manually. Static PNG only.|画像をドロップするかフォルダーを選択してください。相対パスを優先し、次にプロジェクト内で一意のファイル名を照合します。候補が複数ある場合は手動で指定してください。静止 PNG のみ対応。
拖曳圖片到此處，或選擇圖片資料夾|Drop images here or choose a folder|ここに画像をドロップするか、フォルダーを選択
選擇圖片資料夾|Choose image folder|画像フォルダーを選択
匯入圖片|Incoming image|インポート画像
配對原圖|Matching original|対応する元画像
檢查結果|Validation|確認結果
操作|Actions|操作
配對|Match|照合
略過／手動指定|Skip / choose manually|スキップ／手動で指定
圖片規格一致|Image specifications match|画像の仕様が一致
多個候選，請手動指定|Multiple candidates; choose manually|候補が複数あります。手動で指定してください
未配對|Unmatched|未照合
接受差異|Accept differences|差異を承認
同一素材被配對多次，請修正。|The same asset is matched more than once. Please correct it.|同じ素材に複数の画像が指定されています。修正してください。
張待匯入 ·|to import ·|枚をインポート予定 ·
張略過|skipped|枚スキップ
返回工作臺|Back to workbench|ワークベンチに戻る
確認整批匯入|Confirm batch import|一括インポートを確定
放大匯入圖片|Enlarge incoming image|インポート画像を拡大
載入圖片…|Loading image…|画像を読み込み中…
載入原圖…|Loading original…|元画像を読み込み中…
操作完成|Completed|完了
已恢復至操作前|Recovered to previous state|操作前の状態に復旧済み
寫入前取消|Cancelled before writing|書き込み前にキャンセル
準備曾中斷|Preparation interrupted|準備が中断されました
備份完成，操作未結束|Backup saved; operation unfinished|バックアップ済み、操作未完了
寫入曾中斷|Writing interrupted|書き込みが中断されました
恢復曾中斷|Recovery interrupted|復旧が中断されました
恢復未完成|Recovery incomplete|復旧未完了
檢查備份、外部變更與檔案完整性…|Checking backups, external changes and file integrity…|バックアップ、外部変更、ファイル整合性を確認中…
操作已完成並保存紀錄|Operation completed and recorded|操作が完了し、履歴を保存しました
← 返回工作臺|← Back to workbench|← ワークベンチに戻る
套用到遊戲|Apply to game|ゲームに適用
還原遊戲圖片|Restore game images|ゲーム画像を元に戻す
遊戲位置無法驗證，請返回工作臺重新連結。套用／還原已停用。|Cannot verify the game location. Relink it from the workbench. Apply and restore are disabled.|ゲームの場所を確認できません。ワークベンチから再リンクしてください。適用と復元は無効です。
將全部待套用圖片寫入指定遊戲，保留原始備份。|Write all pending images to the selected game, preserving original backups.|保留中の画像を指定ゲームに書き込みます。元画像のバックアップは保持します。
將選取的圖片還原為固定原圖，保留替換版本與歷史紀錄。|Restore selected images to the fixed originals, preserving replacement versions and history.|選択画像を保存済みの元画像に戻します。置換バージョンと履歴は保持します。
目標遊戲|Target game|対象ゲーム
遊戲位置|Game location|ゲームの場所
請先關閉遊戲與其他修改工具；確認後會檢查備份與外部變更。|Close the game and other editing tools first. Backups and external changes will be checked before writing.|ゲームと他の編集ツールを閉じてください。書き込み前にバックアップと外部変更を確認します。
發現未完成操作。確認恢復後，回到該次操作開始前的版本。|An unfinished operation was found. Confirm recovery to return to its starting state.|未完了の操作があります。復旧を確認すると、その操作開始前の状態に戻ります。
確認恢復操作前狀態|Confirm recovery to previous state|操作前の状態への復旧を確認
將|Action:|操作：
套用|Apply|適用
還原|Restore|復元
以下圖片（|images (|対象画像（
張）|images)|枚）
全選已部署素材|Select all deployed assets|適用済み素材をすべて選択
選取|Select|選択
目前遊戲版本|Current game version|現在のゲーム内バージョン
目前替換圖片|Selected replacement|選択中の置換画像
還原至原圖|Restore to original|元画像に戻す
版本／狀態|Version / status|バージョン／状態
原圖|Original|元画像
確認後執行完整性檢查|Integrity checked after confirmation|確認後に整合性を検証
目前沒有|No assets:|該当する素材はありません：
待套用|Pending|適用待ち
已部署|Deployed|適用済み
素材。|assets.|素材。
我已確認目標遊戲、圖片差異與寫入範圍|I have checked the target game, image differences and write scope|対象ゲーム、画像の差異、書き込み範囲を確認しました
處理中，請勿關閉|Processing; do not close|処理中です。閉じないでください
↥ 套用全部待套用圖片|↥ Apply all pending images|↥ 適用待ち画像をすべて適用
↶ 還原選取圖片|↶ Restore selected images|↶ 選択画像を復元
操作紀錄（|Operation history (|操作履歴（
張|images|枚
搜尋素材|Search assets|素材を検索
搜尋檔名或路徑|Search filename or path|ファイル名またはパスを検索
原始資料夾|Original folders|元のフォルダー
全部原始資料夾|All original folders|すべての元フォルダー
已加入群組|Already in group|グループに追加済み
沒有符合條件的素材|No matching assets|一致する素材はありません
已選|Selected:|選択済み：
取消|Cancel|キャンセル
加入素材|Add assets|素材を追加
選擇封面|Select cover|カバーを選択
專案設定|Project settings|プロジェクト設定
專案名稱|Project name|プロジェクト名
專案封面|Project cover|プロジェクトのカバー
專案封面預覽|Project cover preview|カバープレビュー
儲存後使用預設素材封面|The default cover will be used after saving|保存後、既定の素材カバーを使用します
尚無封面|No cover|カバーなし
從專案素材選擇|Choose from project|プロジェクト素材から選択
匯入封面圖片|Import cover image|カバー画像をインポート
恢復預設封面|Reset cover|カバーをリセット
封面另存副本，不改動遊戲圖片。支援靜態 PNG。|The cover is saved as a separate copy. Game images are unchanged. Static PNG only.|カバーは別コピーとして保存します。ゲーム画像は変更しません。静止 PNG のみ対応。
遊戲位置已重新連結並保存|Game location relinked and saved|ゲームの場所を再リンクして保存しました
重新連結遊戲位置|Relink game location|ゲームの場所を再リンク
重新連結會立即保存位置並核對引擎與部署內容，保留原始備份。|Relinking saves the location immediately and verifies the engine and deployed content. Original backups are preserved.|再リンクすると場所を即時保存し、エンジンと適用済み内容を確認します。元のバックアップは保持します。
儲存變更|Save changes|変更を保存
選擇專案封面|Choose project cover|プロジェクトのカバーを選択
永久刪除專案「{0}」？|Permanently delete project “{0}”?|プロジェクト「{0}」を完全に削除しますか？
遊戲位置：|Game location:|ゲームの場所：
將刪除此工具保存的原圖備份、替換版本、封面、群組與操作歷史，且無法復原。|This permanently deletes the tool's original backups, replacement versions, cover, groups and operation history. This cannot be undone.|このツールが保存した元画像のバックアップ、置換バージョン、カバー、グループ、操作履歴を完全に削除します。元に戻せません。
遊戲資料夾不會被刪除，已套用的圖片將維持現狀。刪除後，無法再透過本專案還原原圖。尚未套用的變更將一併刪除。|The game folder is not deleted. Applied images remain unchanged. You will lose this project's ability to restore originals. Pending changes are also deleted.|ゲームフォルダーは削除しません。適用済み画像は現状を保持します。このプロジェクトから元画像に戻せなくなり、未適用の変更も削除されます。
我了解將失去原圖備份與還原能力|I understand that original backups and restore capability will be lost|元画像のバックアップと復元機能を失うことを理解しました
此專案有未完成恢復；我確認放棄恢復，遊戲可能處於部分套用狀態|Recovery is incomplete. I agree to abandon it; the game may be only partially modified|復旧が未完了です。ゲームが一部のみ適用された状態のまま、復旧を放棄することを確認します
清理未完成，可重試：{0}|Cleanup incomplete; retry available: {0}|削除処理は未完了です。再試行できます：{0}
清理中…|Cleaning up…|削除処理中…
永久刪除|Delete permanently|完全に削除
全部素材|All assets|すべての素材
展開收合 {0}|Expand/collapse {0}|{0} を展開／折りたたむ
自訂群組|Custom groups|カスタムグループ
＋ 建立群組|＋ Create group|＋ グループ作成
載入中…|Loading…|読み込み中…
處理中…|Processing…|処理中…
返回專案首頁|Back to projects|プロジェクト一覧に戻る
無法預覽|Preview unavailable|プレビュー不可
放大圖片|Enlarge image|画像を拡大
關閉彈窗|Close dialog|ダイアログを閉じる
適合畫面|Fit to window|ウィンドウに合わせる
· 拖曳／滾輪縮放|· Drag to pan / scroll to zoom|· ドラッグで移動／ホイールで拡大縮小
上傳替換圖片|Upload replacement|置換画像をアップロード
待匯入圖片|Image to import|インポート予定の画像
圖片規格與原圖不同|Image specifications differ from the original|元画像と仕様が異なります
我接受以上差異|I accept these differences|上記の差異を承認します
保存為新版本並選用，不會直接寫入遊戲。|Save and select a new version. The game is not modified yet.|新しいバージョンとして保存して選択します。ゲームにはまだ書き込みません。
確認匯入|Confirm import|インポートを確定
詳細頁只接受一張圖片，批量匯入請返回工作臺。|This page accepts one image. Return to the workbench for batch import.|この画面では画像を1枚だけ受け付けます。一括インポートはワークベンチで行ってください。
原始圖片 · 固定基準|Original image · fixed baseline|元画像 · 固定基準
固定原始圖片|Fixed original image|固定された元画像
匯出 {0}；略過 {1}；失敗 {2} {3}|Exported {0}; skipped {1}; failed {2} {3}|エクスポート {0}、スキップ {1}、失敗 {2} {3}
⇩ 匯出原圖|⇩ Export original|⇩ 元画像を書き出す
目前選用圖片|Selected image|選択中の画像
待套用原圖|Original pending application|適用待ちの元画像
尚未選用替換圖|No replacement selected|置換画像が未選択
已套用|Applied|適用済み
原圖 · 待套用|Original · pending|元画像 · 適用待ち
尚未選用|Not selected|未選択
遊戲：|Game:|ゲーム：
尚無工具部署紀錄|No deployment recorded|適用履歴なし
筆上傳紀錄|upload records|件のアップロード履歴
↥ 上傳替換圖片|↥ Upload replacement|↥ 置換画像をアップロード
選回原圖|Select original|元画像を選択
取消待套用|Cancel pending change|適用待ちを取り消す
匯出目前版本|Export selected version|選択中のバージョンを書き出す
無選用時匯出原圖|Exports original if no version is selected|未選択の場合は元画像を書き出します
上傳歷史|Upload history|アップロード履歴
· 目前選用|· Selected|· 選択中
· 已部署|· Deployed|· 適用済み
預覽 V{0}|Preview V{0}|V{0} をプレビュー
✓ 使用此版本|✓ Use this version|✓ このバージョンを使用
刪除紀錄|Delete version|バージョンを削除
尚無歷史版本|No version history|バージョン履歴なし
✓ 圖片規格一致|✓ Image specifications match|✓ 画像の仕様が一致
永久刪除此歷史版本？|Permanently delete this version?|このバージョンを完全に削除しますか？
取消待套用？|Cancel the pending change?|適用待ちの変更を取り消しますか？
選用此歷史版本？|Select this version?|このバージョンを選択しますか？
選回原圖？確認套用前不會修改遊戲|Select the original? The game stays unchanged until you apply it|元画像を選択しますか？適用を確認するまでゲームは変更しません
永久刪除此版本圖片與歷史。若目前選用此版本，選用將回到遊戲目前版本。|Permanently delete this image version and its history. If selected, selection returns to the current game version.|このバージョンの画像と履歴を完全に削除します。選択中の場合、現在のゲーム内バージョンに選択を戻します。
選用回到遊戲目前版本，保留上傳歷史。|Return selection to the current game version; keep upload history.|現在のゲーム内バージョンに選択を戻し、アップロード履歴は保持します。
保留歷史與已部署版本。|History and deployed versions are preserved.|履歴と適用済みバージョンは保持します。
此操作不會修改遊戲檔案。|This does not modify game files.|ゲームのファイルは変更しません。
確認|Confirm|確認
清理未完成，請重試刪除|Cleanup incomplete; retry deletion|削除処理が未完了です。再試行してください
掃描完成|Scan complete|スキャン完了
有注意事項|Needs attention|要確認
掃描已取消|Scan cancelled|スキャンをキャンセル済み
掃描曾中斷|Scan interrupted|スキャン中断
掃描失敗|Scan failed|スキャン失敗
掃描中|Scanning|スキャン中
載入專案…|Loading projects…|プロジェクトを読み込み中…
無法檢查遊戲位置|Cannot check game location|ゲームの場所を確認できません
專案清單已讀取|Project list loaded|プロジェクト一覧を読み込みました
發現未完成操作，請確認恢復|Unfinished operation found; confirm recovery|未完了の操作があります。復旧を確認してください
專案資料已讀取|Project loaded|プロジェクトを読み込みました
建立原始備份…|Creating original backups…|元画像のバックアップを作成中…
· 原始基準已保存|· Original baseline saved|· 元画像の基準を保存済み
已取消選擇資料夾|Folder selection cancelled|フォルダー選択をキャンセルしました
遊戲目前版本|Current game version|現在のゲーム内バージョン
預覽版本|Preview version|プレビュー中のバージョン
請選擇群組|Select a group|グループを選択してください
群組變更已保存|Group changes saved|グループの変更を保存しました
請將單張圖片拖到目標素材的目前替換圖片欄|Drop a single image onto the target asset's replacement column|画像1枚は対象素材の置換画像欄にドロップしてください
← 專案首頁|← Projects|← プロジェクト一覧
本機專案|Local project|ローカルプロジェクト
重新掃描新增素材|Scan for new assets|追加素材をスキャン
繼續掃描|Resume scan|スキャンを再開
↶ 還原遊戲|↶ Restore game|↶ ゲームを復元
儲存失敗，修改已鎖定|Save failed; changes are locked|保存に失敗しました。変更はロックされています
儲存檢查已通過|Storage check passed|保存先の検証に成功しました
重試儲存檢查|Retry storage check|保存先の検証を再試行
← 返回專案清單|← Back to projects|← プロジェクト一覧に戻る
建立新遊戲專案|Create game project|ゲームプロジェクトを作成
選擇遊戲資料夾，將圖片保存為固定原始基準。|Choose a game folder to save images as a fixed original baseline.|ゲームフォルダーを選択し、画像を固定された元の基準として保存します。
留空則使用遊戲名稱|Leave blank to use game name|空欄の場合はゲーム名を使用
遊戲資料夾|Game folder|ゲームフォルダー
尚未選擇遊戲資料夾|No game folder selected|ゲームフォルダーが未選択
遊戲辨識完成，請確認來源後建立專案|Game detected. Verify the source before creating the project.|ゲームを検出しました。元データを確認してからプロジェクトを作成してください。
選擇資料夾|Choose folder|フォルダーを選択
✓ 已辨識 RPG Maker|✓ Detected RPG Maker|✓ 検出した RPG Maker
標準加密圖片|Standard encrypted images|標準暗号化画像
未加密圖片|Unencrypted images|暗号化なしの画像
建立後會保存原始圖片備份。請使用乾淨的遊戲測試副本；原始基準不會因後續替換而更新。|Original backups will be saved. Use a clean test copy of the game; later replacements never overwrite the original baseline.|元画像のバックアップを保存します。未変更のゲームのテスト用コピーを使用してください。置換しても元の基準は更新されません。
我確認這是未修改的遊戲來源|I confirm this is an unmodified game source|未変更のゲームデータであることを確認しました
建立專案|Create project|プロジェクトを作成
掃描中…|Scanning…|スキャン中…
筆|items|件
取消掃描|Cancel scan|スキャンをキャンセル
遊戲專案|Game projects|ゲームプロジェクト
RPG Asset Workbench · RPG Maker 圖片素材管理工具|RPG Asset Workbench · Image asset manager for RPG Maker|RPG Asset Workbench · RPG Maker 向け画像素材管理ツール
選擇遊戲資料夾以辨識引擎|Choose a game folder to detect its engine|ゲームフォルダーを選択してエンジンを検出
＋ 建立專案|＋ Create project|＋ プロジェクト作成
開啟專案 →|Open project →|プロジェクトを開く →
重試刪除|Retry deletion|削除を再試行
刪除專案|Delete project|プロジェクトを削除
尚無遊戲專案。建立專案後即可管理素材。|No game projects yet. Create one to manage assets.|ゲームプロジェクトはまだありません。作成すると素材を管理できます。
← 返回列表|← Back to list|← 一覧に戻る
正在檢查遊戲位置…|Checking game location…|ゲームの場所を確認中…
工具內已保存的圖片仍可查看。|Saved images remain available for viewing.|保存済みの画像は引き続き閲覧できます。
已保留掃描結果，可稍後繼續；目前尚無法套用到遊戲。|Scan results are saved and can be resumed. Applying to the game is not available yet.|スキャン結果は保存済みで、後から再開できます。ゲームへの適用はまだできません。
素材工作臺 ／|Asset workbench /|素材ワークベンチ ／
張素材|assets|件の素材
＋ 新增素材|＋ Add assets|＋ 素材を追加
群組選單 · 刪除|Delete group|グループを削除
⌄ 展開工具列|⌄ Show tools|⌄ ツールを表示
⌃ 收合工具列|⌃ Hide tools|⌃ ツールを折りたたむ
搜尋檔名|Search filenames|ファイル名を検索
⌕  搜尋檔名…|⌕ Search filenames…|⌕ ファイル名を検索…
狀態篩選|Filter by status|状態で絞り込み
全部狀態|All statuses|すべての状態
尚未替換|No replacement|未置換
預覽背景|Preview background|プレビュー背景
棋盤格|Checkerboard|市松模様
白色|White|白
黑色|Black|黒
自訂|Custom|カスタム
自訂背景色|Custom background color|背景色を指定
批量匯入圖片|Batch import|画像の一括インポート
⇩ 匯出|⇩ Export|⇩ エクスポート
全選目前篩選結果|Select all filtered assets|絞り込み結果をすべて選択
已選取|Selected:|選択済み：
加入群組|Add to group|グループに追加
從目前群組移除|Remove from group|グループから除外
匯出|Export|エクスポート
⚠ 已接受圖片差異|⚠ Differences accepted|⚠ 差異を承認済み
遊戲|Game|ゲーム
→ 選用 V|→ Selected V|→ 選択 V
遊戲 V|Game V|ゲーム V
→ 原圖|→ Original|→ 元画像
無替換版本|No replacement version|置換バージョンなし
詳細內容 →|Details →|詳細 →
刪除版本|Delete version|バージョンを削除
目前範圍沒有素材|No assets in this scope|この範囲に素材はありません
顯示|Showing|表示
顯示 {0} / {1} 張素材|Showing {0} / {1} assets|{1} 件中 {0} 件を表示
上一頁|Previous|前へ
下一頁|Next|次へ
處理 {0} 筆 · 注意 {1} 筆 · {2}|Processed {0} · Warnings {1} · {2}|処理済み {0} 件 · 注意 {1} 件 · {2}
確認掃描差異|Review scan changes|スキャンの差分を確認
只保存下列新增路徑。既有變更不覆寫基準，來源缺失不刪除工具資料。|Only new paths below will be saved. Changes never overwrite baselines; missing sources never delete saved data.|以下の新しいパスのみ保存します。既存の変更で基準を上書きせず、元データが欠けても保存済みデータは削除しません。
新增|New|追加
既有變更／無可用基準|Changed / no valid baseline|変更あり／有効な基準なし
來源缺失|Missing source|元データなし
掃描結果已保存|Scan results saved|スキャン結果を保存しました
確認新增／繼續掃描|Confirm additions / resume|追加を確認／スキャンを再開
匯出圖片|Export images|画像をエクスポート
範圍|Scope|範囲
勾選的素材（|Selected assets (|選択した素材（
目前篩選範圍|Current filter|現在の絞り込み範囲
整個專案|Entire project|プロジェクト全体
來源|Source|元データ
固定原圖|Fixed original|固定された元画像
目前選用版本（無選用則原圖）|Selected version (original if none)|選択中のバージョン（未選択なら元画像）
保留原始相對路徑，不可讀取的素材不列入匯出。|Preserve relative paths. Unreadable assets are excluded.|元の相対パスを保持します。読み取れない素材は対象外です。
選擇目的地並匯出|Choose destination and export|保存先を選択してエクスポート
建立群組|Create group|グループ作成
從群組移除素材|Remove assets from group|グループから素材を除外
刪除群組|Delete group|グループを削除
群組名稱|Group name|グループ名
重新命名群組|Rename group|グループ名を変更
目標群組|Target group|対象グループ
只移除群組關聯，不會刪除圖片、歷史或遊戲檔案。|Only group membership is removed. Images, history and game files are preserved.|グループとの関連付けのみ解除します。画像、履歴、ゲームファイルは削除しません。
專案及工具保存的相關資料已刪除；遊戲維持現狀|Project and saved tool data deleted; game unchanged|プロジェクトと関連する保存データを削除しました。ゲームは変更していません
新增素材至群組「{0}」|Add assets to “{0}”|グループ「{0}」に素材を追加
素材已加入群組|Assets added to group|素材をグループに追加しました
永久刪除待套用版本？|Permanently delete the pending version?|適用待ちバージョンを完全に削除しますか？
刪除此版本圖片與上傳紀錄，且無法復原。選用將回到遊戲目前版本。|Permanently delete this version and its upload record. Selection returns to the current game version.|このバージョンの画像と履歴を完全に削除します。選択は現在のゲーム内バージョンに戻ります。
選用回到遊戲目前版本，保留所有上傳歷史。|Return selection to the current game version; keep all upload history.|現在のゲーム内バージョンに選択を戻し、すべてのアップロード履歴を保持します。
此操作不寫入遊戲。|This does not write to the game.|ゲームへの書き込みは行いません。
返回|Back|戻る
永久刪除版本|Delete version permanently|バージョンを完全に削除
確認取消待套用|Confirm cancellation|取り消しを確認
確認大圖處理|Confirm large image processing|大きな画像の処理を確認
{0}\n{1} × {2}\n大圖處理可能使用較多記憶體與時間，將逐張處理並保留原檔。是否繼續？|{0}\n{1} × {2}\nLarge images may require more memory and time. Images are processed one at a time and originals are preserved. Continue?|{0}\n{1} × {2}\n大きな画像はメモリと時間を多く使用する場合があります。1枚ずつ処理し、元ファイルは保持します。続行しますか？
繼續處理大圖|Process large image|大きな画像を処理
已取消大圖處理|Large image processing cancelled|大きな画像の処理をキャンセルしました
語言|Language|言語
目前沒有待套用素材。|No pending assets.|適用待ちの素材はありません。
目前沒有已部署素材。|No deployed assets.|適用済みの素材はありません。
操作紀錄（{0}）|Operation history ({0})|操作履歴（{0}）
已選 {0} 張|{0} selected|{0} 枚選択済み
{0} 筆上傳紀錄|{0} upload records|{0} 件のアップロード履歴
{0} 張素材|{0} assets|{0} 件の素材
{0} 張待匯入 · {1} 張略過|{0} to import · {1} skipped|{0} 枚をインポート予定 · {1} 枚スキップ
套用以下 {0} 張圖片|Apply these {0} images|以下の {0} 枚の画像を適用
還原以下 {0} 張圖片|Restore these {0} images|以下の {0} 枚の画像を復元
`;
export const messages: Record<string, [string, string]> = Object.fromEntries(
  rows
    .trim()
    .split('\n')
    .map((line) => {
      const [key, en, ja] = line.split('|').map((s) => s.replaceAll('\\n', '\n'));
      return [key, [en, ja]];
    }),
);
