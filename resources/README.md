# R-aW 應用程式圖示

2026-10-25 使用者選定方案 02：薄荷綠 R 字母內含山形與圓日，深色圓角底，外圍透明。

- `icon-source.png`：imagegen 產生的獨立圖示原稿，保留原始 alpha。
- `icon.png`：512×512，Header、Electron 視窗與四語 README 共用。
- `icon.ico`：16／24／32／48／64／128／256 像素七種 PNG 編碼影格，用於 Windows EXE。
- 重建衍生檔：在專案根目錄執行 `node scripts/build-icon.cjs`；使用既有 sharp，不新增依賴，只做尺寸及格式轉換。

生成方式：內建 imagegen，參考三方案圖中的中間方案，非 CLI。提示詞如下：

> Edit the supplied comparison sheet: extract and faithfully reproduce ONLY the CENTER icon concept 02 as one standalone production application icon. Preserve its exact visual identity: bold mint green R monogram, inside the R counter a pale mint mountain silhouette and round sun, dark charcoal rounded-square tile. Square 1024x1024 canvas, icon tile centered occupying about 94% of width and height with small even transparent margin. Transparent alpha outside the rounded square, opaque charcoal inside. Straight-on front view, sharp clean edges and flat vector-like forms. Preserve original proportions and mint palette; remove presentation background, numbers, and other icons completely. No letters other than the R formed by the logo. No captions, no external shadows. Deliver one icon only.
