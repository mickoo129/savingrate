document.addEventListener('DOMContentLoaded', () => {
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');
    const loading = document.getElementById('loading');
    const loadingText = document.getElementById('loading-text');
    const resultContainer = document.getElementById('result-container');
    const tableWrapper = document.getElementById('table-wrapper');
    const summaryEl = document.getElementById('summary');
    const errorMessage = document.getElementById('error-message');
    const resetBtn = document.getElementById('reset-btn');

    // 觸發檔案選擇
    uploadArea.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (event) => {
        const files = event.target.files;
        if (files.length > 0) handleFile(files[0]);
    });

    // 拖放
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

    // 重新上傳
    resetBtn.addEventListener('click', () => {
        resultContainer.style.display = 'none';
        errorMessage.style.display = 'none';
        uploadArea.style.display = 'block';
        fileInput.value = '';
    });

    // 處理檔案
    async function handleFile(file) {
        // 檢查檔案大小 (Netlify Functions 上限約 6MB)
        const maxSize = 6 * 1024 * 1024;
        if (file.size > maxSize) {
            displayError('檔案過大 (上限 6MB)，請壓縮後再上傳。');
            return;
        }

        uploadArea.style.display = 'none';
        resultContainer.style.display = 'none';
        errorMessage.style.display = 'none';
        loading.style.display = 'block';
        loadingText.textContent = '正在上傳並分析文件，請稍候...';

        try {
            const base64File = await fileToBase64(file);

            const response = await fetch('/.netlify/functions/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filename: file.name,
                    mimetype: file.type,
                    data: base64File
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || `伺服器錯誤 (${response.status})`);
            }

            if (!result.data || result.data.length === 0) {
                throw new Error('無法從文件中識別出保單數據。請確認文件清晰、包含標準的保單年度與金額表格。');
            }

            displayResults(result);
        } catch (error) {
            console.error('分析失敗：', error);
            displayError(error.message || '分析失敗，請稍後再試。');
        }
    }

    // 檔案轉 Base64
    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = (err) => reject(err);
        });
    }

    // 顯示錯誤
    function displayError(message) {
        loading.style.display = 'none';
        errorMessage.textContent = '分析失敗：' + message;
        errorMessage.style.display = 'block';
        uploadArea.style.display = 'block';
    }

    // 顯示結果
    function displayResults(result) {
        loading.style.display = 'none';
        const data = result.data;

        // 摘要卡片
        const lastRow = data[data.length - 1];
        const breakevenYear = data.find(r => r.netReturn >= 0);
        const breakevenText = breakevenYear ? `第 ${breakevenYear.year} 年` : '未達回本';

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

        // 表格
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

        // 每 5 年一個里程碑行（highlighted）
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

    function formatCurrency(number) {
        if (number === null || number === undefined || isNaN(number)) return '—';
        return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(number));
    }

    function formatPercent(number) {
        if (number === null || number === undefined || isNaN(number)) return '—';
        return number.toFixed(2) + '%';
    }
});
