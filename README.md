# 保單回報分析工具 (Saving Rate Analyzer)

一個為專業財務策劃顧問設計的網頁工具，能夠快速讀取 PDF 或圖片格式的保單建議書，自動提取關鍵數據 (保單年度、已繳總保費、保證金額、非保證金額、總現金價值)，並計算每個年度的年化回報率 (IRR)。

## 功能特色

- **拖放式上傳介面**：支援 PDF、PNG、JPG 等常見格式
- **OCR 自動辨識**：使用 Tesseract.js 辨識中英文內容
- **自動數據提取**：智能解析保單表格
- **年化回報率 (IRR) 計算**：以牛頓法 + 二分法雙重保障的精確計算
- **里程碑年度高亮**：每 5 年自動標記，方便顧問向客戶展示
- **摘要卡片**：一眼看出回本年度、最終總現金價值、最終 IRR
- **專業介面**：適合顧問在客戶面前展示使用

## 技術架構

| 層級 | 技術 |
|---|---|
| 前端 | 純 HTML + CSS + JavaScript (無框架，部署輕量) |
| 後端 | Netlify Serverless Functions (Node.js) |
| OCR | Tesseract.js (繁體中文 + 英文) |
| PDF 解析 | pdfjs-dist + canvas |
| 部署 | Netlify (靜態前端 + Functions) |

## 專案結構

```
savingrate/
├── index.html              # 前端首頁
├── style.css               # 樣式
├── script.js               # 前端邏輯
├── netlify.toml            # Netlify 設定
├── netlify/
│   └── functions/
│       ├── analyze.js      # 主入口 API
│       ├── package.json    # Functions 依賴
│       └── lib/
│           ├── ocr.js        # OCR 模組
│           ├── parser.js     # 文字解析模組
│           └── calculator.js # IRR 計算模組
└── README.md
```

## 部署步驟 (Netlify)

1. **連接 GitHub 儲存庫**
   - 登入 [Netlify](https://app.netlify.com)
   - 選擇 **Add new site** → **Import an existing project**
   - 選擇 GitHub 並授權
   - 選擇 `mickoo129/savingrate` 儲存庫

2. **設定建置選項** (Netlify 會自動從 `netlify.toml` 讀取)
   - Build command: 留空
   - Publish directory: `.`
   - Functions directory: `netlify/functions`

3. **點擊 Deploy Site**

4. 第一次部署可能需 3-5 分鐘以安裝 OCR 相關依賴

## 本地測試 (可選)

```bash
# 安裝 Netlify CLI
npm install -g netlify-cli

# 安裝 Functions 依賴
cd netlify/functions
npm install
cd ../..

# 啟動開發伺服器
netlify dev
```

開啟瀏覽器訪問 http://localhost:8888

## 使用注意事項

1. **檔案大小**：單次上傳上限 6 MB (Netlify Functions 限制)
2. **OCR 時間**：首次處理 PDF 可能需要 30-60 秒
3. **辨識準確度**：取決於原始檔案的清晰度。若為截圖，建議使用高解析度截圖
4. **保單格式差異**：不同保險公司的保單建議書格式不同，若辨識不理想，可能需要針對特定格式調整 `parser.js` 的解析規則

## 後續優化方向 (Roadmap)

- [ ] 第二階段：加入 Chart.js 繪製現金流圖表與 IRR 趨勢線
- [ ] 第三階段：加入非保證紅利實現率滑桿 (壓力測試)
- [ ] 匯出 PDF 報告功能
- [ ] 支援多份保單對比
- [ ] 針對主要保險公司 (Manulife, AIA, Prudential, AXA 等) 優化解析規則

## 免責聲明

本工具的計算結果基於 OCR 辨識出的數據，**僅供財務分析參考**。實際保單權益請以保險公司提供的正式文件為準。

---

© 2026 | 專業財務策劃顧問輔助工具
