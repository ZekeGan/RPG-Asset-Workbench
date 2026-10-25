# 開始交接給 Codex

這是0.4.0原始碼＋2026-10-23最新交接文件的整合包。AGENTS.md已完成合併，不必再下載或手動搬入其他交接檔案。待辦尚未實作，沒有開始下一版開發。

## 最少操作

1. 將ZIP解壓到新的固定專案資料夾。
2. 用VS Code／Codex開啟包含本文件與package.json的rpg-image-tool-poc資料夾。
3. 對Codex輸入：

> 請先閱讀根目錄 AGENTS.md 與 docs/handoff-2026-10-23/HANDOFF.md，依指引完成只讀交接核對，回報目前狀態、已確認需求與待辦。先不要修改代碼、安裝套件、升版或執行 Git 寫入；等我授權後再開發。

完整接手文字在[首次指引](../../docs/handoff-2026-10-23/FIRST_CODEX_MESSAGE.md)。先交接不需要npm ci或建置。

## 本機修改與Git

本包包含先前交付的0.4.0，不包含你本機後來的手動修改，也沒有.git。如果你已有修改或Git歷史，保留原資料夾，不要直接覆蓋。告訴Codex兩份資料夾的路徑，先只讀比較；取得授權後再將文件與必要差異合併到原Git專案。

如果沒有本機修改或既有Git，這份解壓目錄可作為之後唯一專案資料夾。Git初始化、連接私人GitHub、commit與push仍須另行授權並確認遠端；本包不會自動操作。這次交接不包含可直接執行的Windows exe。

## 文件入口

- [交接總覽](../../docs/handoff-2026-10-23/HANDOFF.md)
- [23項待辦](../../docs/handoff-2026-10-23/BACKLOG.md)
- [已確認決策](../../docs/handoff-2026-10-23/DECISIONS.md)
- [未決項](../../docs/handoff-2026-10-23/OPEN_ITEMS.md)
- [Mockup對應](../../docs/handoff-2026-10-23/MOCKUP_MAP.md)
- [實作與測試狀態](../../docs/handoff-2026-10-23/STATUS_AND_TESTS.md)
- [Git接手流程](../../docs/handoff-2026-10-23/GIT_AND_CODEX.md)

