// 保單文字解析模組
// 從 OCR 辨識後的文字中提取：保單年度、已繳總保費、保證金額、非保證金額、總額

/**
 * 主解析函數
 * @param {string} text - OCR 辨識出的完整文字
 * @returns {Array<{year:number, premium:number, guaranteed:number, nonGuaranteed:number, total:number}>}
 */
function parsePolicyText(text) {
    if (!text || typeof text !== 'string') return [];

    // 預處理：去除多餘空白、統一格式
    const cleanedText = text
        .replace(/\r/g, '')
        .replace(/[\u3000]/g, ' ')  // 全形空格 → 半形
        .replace(/[,，]/g, ',');    // 統一逗號

    const lines = cleanedText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    // 策略：逐行掃描，識別形如 "年度  保費  保證  非保證  總額" 的數據行
    const rows = [];
    const seenYears = new Set();

    for (const line of lines) {
        const row = extractRowFromLine(line);
        if (row && !seenYears.has(row.year)) {
            rows.push(row);
            seenYears.add(row.year);
        }
    }

    // 按年度排序
    rows.sort((a, b) => a.year - b.year);

    return rows;
}

/**
 * 從單一行文字中提取數據
 * 保單表格典型格式 (不同公司可能不同):
 *   年度 | 年齡 | 已繳總保費 | 保證現金價值 | 非保證/紅利 | 總現金價值
 *
 * 我們使用啟發式規則：
 * - 第一個小數字 (1-100) 視為保單年度
 * - 後面連續的大數字視為金額
 * - 至少需要 3 個金額才認為是有效數據行
 */
function extractRowFromLine(line) {
    // 去除非數字/空格/逗號/點/負號的字元，但保留結構
    // 先找出該行所有數字 (含千分位逗號和小數點)
    const numberPattern = /-?\d{1,3}(?:,\d{3})+(?:\.\d+)?|-?\d+(?:\.\d+)?/g;
    const matches = line.match(numberPattern);

    if (!matches || matches.length < 4) return null;

    // 轉為數字
    const nums = matches.map(s => parseFloat(s.replace(/,/g, ''))).filter(n => !isNaN(n));

    if (nums.length < 4) return null;

    // 第一個數字應為保單年度 (1-100)
    const year = nums[0];
    if (!Number.isInteger(year) || year < 1 || year > 100) return null;

    // 尋找後面的金額 (應為較大的正整數)
    // 典型順序: [年度, (年齡), 已繳保費, 保證, 非保證, 總額]
    const amounts = nums.slice(1).filter(n => n >= 0);

    if (amounts.length < 3) return null;

    // 啟發式判斷：
    // - 如果第二個數字 < 150 且第三個數字 > 100，很可能第二個是年齡，跳過
    let offset = 0;
    if (amounts[0] < 150 && amounts[0] === Math.floor(amounts[0]) && amounts[1] > amounts[0] * 10) {
        offset = 1; // 第一個是年齡
    }

    const remaining = amounts.slice(offset);
    if (remaining.length < 3) return null;

    // 解析邏輯：
    // 若有 4 個金額 → [保費, 保證, 非保證, 總額]
    // 若有 3 個金額 → [保費, 保證, 非保證] (總額自行加總)
    let premium, guaranteed, nonGuaranteed, total;

    if (remaining.length >= 4) {
        [premium, guaranteed, nonGuaranteed, total] = remaining;
        // 驗證：保證 + 非保證 ≈ 總額 (允許 10% 誤差)
        const calculated = guaranteed + nonGuaranteed;
        if (total > 0 && Math.abs(calculated - total) / total > 0.15) {
            // 可能順序不對，嘗試另一種組合: [保費, 保證, 總額, 非保證]
            const alt = guaranteed + remaining[3];
            if (Math.abs(alt - remaining[2]) / remaining[2] <= 0.15) {
                total = remaining[2];
                nonGuaranteed = remaining[3];
            }
        }
    } else if (remaining.length === 3) {
        [premium, guaranteed, nonGuaranteed] = remaining;
        total = guaranteed + nonGuaranteed;
    }

    // 基本健全性檢查
    if (!premium || premium < 0 || !guaranteed || guaranteed < 0) return null;
    if (premium > 100000000) return null;  // 1億以上視為不合理
    if (nonGuaranteed < 0) nonGuaranteed = 0;
    if (!total || total < guaranteed) total = guaranteed + nonGuaranteed;

    return {
        year: Math.round(year),
        premium: Math.round(premium),
        guaranteed: Math.round(guaranteed),
        nonGuaranteed: Math.round(nonGuaranteed),
        total: Math.round(total)
    };
}

module.exports = { parsePolicyText, extractRowFromLine };
