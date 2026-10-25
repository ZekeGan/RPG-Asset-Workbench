# 0.5.4 — 2026-10-25

修正 `pack:zip` 在部分 PowerShell 環境無 `Get-FileHash` 時，ZIP 已產生但 SHA-256 步驟失敗的問題。改用 .NET SHA-256 計算，產出相同格式的 `.zip.sha256`。ZIP 內容與檔案校驗仍須以重新打包的 0.5.4 成品驗證。
