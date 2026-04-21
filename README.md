# 保單回報分析工具 (Saving Rate Analyzer)

一個為專業財務策劃顧問設計的網頁工具，能夠快速讀取 PDF 或圖片格式的保單建議書，自動提取關鍵數據 (保單年度、已繳總保費、保證金額、非保證金額、總現金價值)，並計算每個年度的年化回報率 (IRR)。

## 功能特色

- **拖放式上傳介面**：支援 PDF、PNG、JPG 等常見格式
- **智能雙軌辨識**：
  - 電子版 PDF → 直接提取文字 (快速、高準確度)
  - 掃描版 PDF / 圖片 → 瀏覽器內 OCR 辨識 (繁中 + 英文)
- **自動數據提取**：智能解析保單表格
- **年化回報率 (IRR) 計算**：牛頓法 + 二分法雙重保障
- **里程碑年度高亮**：每 5 年自動標記
- **摘要卡片**：一眼看出回本年度、最終總現金價值、最終 IRR
- **原始文字檢視**：可查看 OCR 辨識結果以便除錯
- **即時進度顯示**：讓顧問在客戶面前使用時不會有尷尬的等待

## 技術架構

本專案採用「**前端重、後端輕**」的架構，確保 Netlify 部署穩定：

| 層級 | 技術 |
|---|---|
| 前端 | HTML + CSS + JavaScript |
| 前端 PDF 處理 | [pdf.js](https://mozilla.github.io/pdf.js/) (CDN 載入) |
| 前端 OCR | [tesseract.js](https://tesseract.projectnaptha.com/) (CDN 載入) |
| 後端 | Netlify Serverless Functions (Node.js，**零原生依賴**) |
| 後端職責 | 僅做文字解析 + IRR 計算 |

### 為什麼這樣設計？

1. **避免 Netlify build 失敗**：將 OCR 放前端能繞開 `canvas` 等需要原生編譯的依賴
2. **執行速度更快**：避免 Serverless Function 的冷啟動
3. **成本更低**：OCR 在使用者瀏覽器執行，不消耗 Netlify Function 額度
4. **無超時風險**：不受 Netlify 免費方案 10 秒執行限制

## 專案結構

```
savingrate/
├── index.html              # 前端首頁
├── style.css               # 樣式
├── script.js               # 前端邏輯 (PDF + OCR)
├── netlify.toml            # Netlify 設定
├── netlify/
│   └── functions/
│       ├── analyze.js      # 主 API (純 JS，零依賴)
│       ├── package.json
│       └── lib/
│           ├── parser.js     # 文字解析模組
│           └── calculator.js # IRR 計算模組
└── README.md
```

## 部署步驟 (Netlify)

1. 登入 [Netlify](https://app.netlify.com) → **Add new site** → **Import an existing project**
2. 選擇 GitHub 並授權，選擇 `mickoo129/savingrate` 儲存庫
3. 設定會自動從 `netlify.toml` 讀取，**直接點擊 Deploy Site**
4. 部署通常在 1 分鐘內完成

## 使用流程

1. 開啟網站
2. 拖放或點擊上傳 PDF / 圖片
3. 前端自動判斷文件類型並處理：
   - 電子版 PDF：幾秒內完成
   - 圖片或掃描版 PDF：視解析度與頁數，約 15-60 秒
4. 處理結果送到 Netlify Function → 回傳結構化數據
5. 前端顯示摘要卡片、完整年度表格、IRR 趨勢

## 使用注意事項

1. **檔案大小**：建議 20 MB 以內
2. **辨識品質**：OCR 準確度取決於原始檔案清晰度，建議使用原始電子版 PDF
3. **瀏覽器相容性**：建議使用 Chrome / Edge / Safari 最新版
4. **保單格式差異**：若辨識結果不理想，可點擊「原始文字」檢視 OCR 輸出，有助判斷是辨識問題還是解析規則問題

## 後續優化方向

- [ ] 加入 Chart.js 繪製現金流圖表與 IRR 趨勢線
- [ ] 加入非保證紅利實現率滑桿 (壓力測試情景分析)
- [ ] 匯出 PDF 報告功能
- [ ] 支援多份保單對比
- [ ] 針對主要保險公司 (Manulife, AIA, Prudential, AXA 等) 優化解析規則

## 免責聲明

本工具的計算結果基於文件辨識，**僅供財務分析參考**。實際保單權益請以保險公司提供的正式文件為準。

---

© 2026 | 專業財務策劃顧問輔助工具
