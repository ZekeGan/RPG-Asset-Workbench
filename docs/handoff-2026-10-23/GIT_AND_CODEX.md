# Git 與 Codex 接手流程

本文件是操作指南，不是執行紀錄。本輪沒有初始化Git、建立遠端、commit、push或發布。

1. 本整合包以先前交付0.4.0為基準，沒有使用者本機手動修改。解壓至新資料夾；若本機有改碼或已有.git，保留舊資料夾，先由Codex只讀比較再決定合併，不能直接覆蓋或假裝已同步歷史。
2. docs/handoff-2026-10-23/已放入專案，無須另行複製。
3. 根目錄AGENTS.md已合併最新閱讀指引與原基準規則，無須手動貼入。先前獨立交接包的merge/及安裝步驟不適用本整合包。
4. Codex先只讀檢查 git status、git branch --show-current、git remote -v、git diff。無.git時如實回報；當使用者授權建立才初始化。不要發明GitHub URL。
5. 提交前檢查.gitignore及暫存內容，排除node_modules、out、release、遊戲圖片／密鑰、DB／備份、環境私密資料。保留package-lock、來源、Mockup、專案文件與必要VS Code設定。基準.gitignore會忽略*.log，本包的歷史log是刻意提供的無私有素材測試證據；若要版本管理，僅對明確檢查過的evidence檔加入例外，不移除全域保護或強制加入所有log。
6. 明確授權後，以當前實際版本建立基準commit，再以獨立commit記錄交接文件。尚未存在的過往commit無法由Work聊天重建；不要假造歷史。手動改過的版本不冒稱未修改v0.4.0。
7. 私人GitHub儲存庫／連線確認後才push；不要force push或重設使用者分支。本輪未核准對外公開。
8. 在VS Code/Codex開啟同一資料夾，以FIRST_CODEX_MESSAGE.md作接手指引。完成理解回報後，等明確授權才建立開發分支與修改功能。
9. 本機Codex改的就是本機工作樹，無須每版解壓；另一台／雲端才透過Git同步。Git不會備份Electron userData、遊戲副本、完整聊天／執行環境，也不自動產生Windows執行檔。

聊天原文可作補充，這份文件不是逐字聊天匯出。原PRD、Mockup與最新決策一起保留，避免只移動程式碼而失去需求。
