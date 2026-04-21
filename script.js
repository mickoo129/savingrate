// 前端主邏輯：
// 1. 接收使用者上傳的 PDF / 圖片
// 2. PDF: 先嘗試直接提取文字 (pdf.js)，若是掃描版 PDF 則退回 OCR
// 3. 圖片: 直接用 tesseract.js OCR
// 4. 將抽出的文字送到 Netlify Function 做解析 + IRR 計算
// 5. 顯示表格

// PDF.js worker
if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
}

document.addEventListener('DOMContentLoaded', () => {
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');
    const loading = document.getElementById('loading');
    const loadingText = document.getElementById('loading-text');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    const resultContainer = document.getElementById('result-container');
    const tableWrapper = document.getElementById('table-wrapper');
    const summaryEl = document.getElementById('summary');
    const errorMessage = document.getElementById('error-message');
    const resetBtn = document.getElementById('reset-btn');
    const viewRawBtn = document.getElementById('view-raw-btn');
    const rawTextEl = document.getElementById('raw-text');

    let lastRawText = '';

    // 上傳事件
    uploadArea.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) handleFile(e.target.files[0]);
    });

    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });
    uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) handleFile(e.dataTransfer.files[0]);
    });

    resetBtn.addEventListener('click', () => {
        resultContainer.style.display = 'none';
        errorMessage.style.display = 'none';
        uploadArea.style.display = 'block';
        fileInput.value = '';
        rawTextEl.style.display = 'none';
    });

    viewRawBtn.addEventListener('click', () => {
        if (rawTextEl.style.display === 'none') {
            rawTextEl.textContent = lastRawText || '(沒有原始文字)';
            rawTextEl.style.display = 'block';
            viewRawBtn.textContent = '隱藏原始文字';
        } else {
            rawTextEl.style.display = 'none';
            viewRawBtn.textContent = '原始文字';
        }
    });

    // 主流程
    async function handleFile(file) {
        const maxSize = 20 * 1024 * 1024;
        if (file.size > maxSize) {
            displayError('檔案過大 (上限 20MB)，請壓縮後再上傳。');
            return;
        }

        uploadArea.style.display = 'none';
        resultContainer.style.display = 'none';
        errorMessage.style.display = 'none';
        loading.style.display = 'block';
        updateProgress(0, '準備中...');

        try {
            let text = '';

            if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
                // PDF 處理
                updateProgress(5, '讀取 PDF...');
                text = await extractTextFromPDF(file);

                // 若直接提取的文字太少，可能是掃描版 PDF，改用 OCR
                if (text.trim().length < 100) {
                    updateProgress(15, '偵測到掃描版 PDF，啟動 OCR...');
                    text = await ocrPDF(file);
                }
            } else if (file.type.startsWith('image/')) {
                // 圖片處理
                updateProgress(10, '啟動 OCR 辨識...');
                text = await ocrImage(file);
            } else {
                throw new Error('不支援的檔案格式，請上傳 PDF 或圖片。');
            }

            lastRawText = text;

            if (!text || text.trim().length < 20) {
                throw new Error('無法從文件中讀取到足夠的文字內容，請確認文件清晰度。');
            }

            // 送到後端進行數據解析 + IRR 計算
            updateProgress(92, '分析數據與計算 IRR...');
            const response = await fetch('/.netlify/functions/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: text })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || `伺服器錯誤 (${response.status})`);
            }

            if (!result.data || result.data.length === 0) {
                throw new Error('無法從文件中識別出保單數據。請確認文件清晰、包含標準的保單年度與金額表格。您可以點擊「原始文字」檢視辨識結果。');
            }

            updateProgress(100, '完成');
            displayResults(result);
        } catch (error) {
            console.error('分析失敗：', error);
            displayError(error.message || '分析失敗，請稍後再試。');
        }
    }

    // 從 PDF 直接提取文字 (不需 OCR)
    async function extractTextFromPDF(file) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let allText = '';

        const maxPages = Math.min(pdf.numPages, 20);  // 最多處理 20 頁
        for (let i = 1; i <= maxPages; i++) {
            updateProgress(5 + (i / maxPages) * 10, `讀取 PDF 第 ${i}/${maxPages} 頁...`);
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const pageText = content.items.map(item => item.str).join(' ');
            allText += pageText + '\n';
        }

        return allText;
    }

    // 掃描版 PDF 的 OCR 處理
    async function ocrPDF(file) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const maxPages = Math.min(pdf.numPages, 5);  // OCR 慢，只處理前 5 頁
        let allText = '';

        const worker = await window.Tesseract.createWorker(['chi_tra', 'eng'], 1, {
            logger: (m) => {
                if (m.status === 'recognizing text') {
                    const base = 15 + (m.progress * 75);
                    updateProgress(base, `OCR 辨識中 ${Math.round(m.progress * 100)}%...`);
                }
            }
        });

        try {
            for (let i = 1; i <= maxPages; i++) {
                const page = await pdf.getPage(i);
                const viewport = page.getViewport({ scale: 2.0 });
                const canvas = document.createElement('canvas');
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                const ctx = canvas.getContext('2d');

                await page.render({ canvasContext: ctx, viewport: viewport }).promise;

                const { data: { text } } = await worker.recognize(canvas);
                allText += text + '\n';
            }
        } finally {
            await worker.terminate();
        }

        return allText;
    }

    // 圖片 OCR
    async function ocrImage(file) {
        const worker = await window.Tesseract.createWorker(['chi_tra', 'eng'], 1, {
            logger: (m) => {
                if (m.status === 'recognizing text') {
                    const base = 10 + (m.progress * 80);
                    updateProgress(base, `OCR 辨識中 ${Math.round(m.progress * 100)}%...`);
                }
            }
        });

        try {
            const { data: { text } } = await worker.recognize(file);
            return text;
        } finally {
            await worker.terminate();
        }
    }

    function updateProgress(percent, msg) {
        progressFill.style.width = Math.min(100, percent) + '%';
        if (msg) progressText.textContent = msg;
    }

    function displayError(message) {
        loading.style.display = 'none';
        errorMessage.textContent = '分析失敗：' + message;
        errorMessage.style.display = 'block';
        uploadArea.style.display = 'block';
    }

    function displayResults(result) {
        loading.style.display = 'none';
        const data = result.data;

        const lastRow = data[data.length - 1];
        const breakevenRow = data.find(r => r.netReturn >= 0);
        const breakevenText = breakevenRow ? `第 ${breakevenRow.year} 年` : '未達回本';

        summaryEl.innerHTML = `
            <div class="summary-card">
                <div class="label">分析保單年度數</div>
                <div class="value">${data.length} 年</div>
            </div>
            <div class="summary-card">
                <div class="label">預計回本年度</div>
                <div class="value highlight">${breakevenText}</div>
            </div>
            <div class="summary-card">
                <div class="label">最終總現金價值</div>
                <div class="value">${formatCurrency(lastRow.total)}</div>
            </div>
            <div class="summary-card">
                <div class="label">最終年化回報率 (IRR)</div>
                <div class="value highlight">${formatPercent(lastRow.irr)}</div>
            </div>
        `;

        let tableHTML = `
            <table>
                <thead>
                    <tr>
                        <th>保單年度</th>
                        <th>已繳總保費</th>
                        <th>保證金額</th>
                        <th>非保證金額</th>
                        <th>總現金價值</th>
                        <th>淨回報</th>
                        <th>年化回報率 (IRR)</th>
                    </tr>
                </thead>
                <tbody>
        `;

        data.forEach(row => {
            const isMilestone = row.year % 5 === 0;
            tableHTML += `
                <tr class="${isMilestone ? 'milestone' : ''}">
                    <td>${row.year}</td>
                    <td>${formatCurrency(row.premium)}</td>
                    <td>${formatCurrency(row.guaranteed)}</td>
                    <td>${formatCurrency(row.nonGuaranteed)}</td>
                    <td>${formatCurrency(row.total)}</td>
                    <td class="${row.netReturn >= 0 ? 'positive' : 'negative'}">${formatCurrency(row.netReturn)}</td>
                    <td class="${row.irr >= 0 ? 'positive' : 'negative'}">${formatPercent(row.irr)}</td>
                </tr>
            `;
        });

        tableHTML += '</tbody></table>';
        tableWrapper.innerHTML = tableHTML;
        resultContainer.style.display = 'block';
    }

    function formatCurrency(n) {
        if (n === null || n === undefined || isNaN(n)) return '—';
        return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(n));
    }

    function formatPercent(n) {
        if (n === null || n === undefined || isNaN(n)) return '—';
        return n.toFixed(2) + '%';
    }
});
