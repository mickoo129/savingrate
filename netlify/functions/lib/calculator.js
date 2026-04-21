// 計算模組：淨回報與 IRR

/**
 * 為每一行數據計算 IRR 和淨回報
 * @param {Array} policyData - 來自 parser 的數據
 * @returns {Array} 加入 netReturn 和 irr 欄位
 */
function calculateMetrics(policyData) {
    if (!policyData || policyData.length === 0) return [];

    // 推算每年保費：從已繳總保費的遞增來計算
    const annualPremiums = inferAnnualPremiums(policyData);

    return policyData.map((row, idx) => {
        const netReturn = row.total - row.premium;
        const irr = computeIRR(annualPremiums, row.year, row.total);

        return {
            year: row.year,
            premium: row.premium,
            guaranteed: row.guaranteed,
            nonGuaranteed: row.nonGuaranteed,
            total: row.total,
            netReturn: netReturn,
            irr: isNaN(irr) || !isFinite(irr) ? 0 : irr * 100
        };
    });
}

/**
 * 推算每年保費
 * 例如：第1年 premium=10000, 第2年 premium=20000 → 每年保費 10000
 * 若總保費停止增長 (保費繳完) 則之後 = 0
 */
function inferAnnualPremiums(policyData) {
    const annual = {};  // year → 該年繳的保費
    let prevYear = 0;
    let prevPremium = 0;

    for (const row of policyData) {
        const yearGap = row.year - prevYear;
        const premiumGap = row.premium - prevPremium;
        const perYear = yearGap > 0 ? premiumGap / yearGap : 0;

        for (let y = prevYear + 1; y <= row.year; y++) {
            annual[y] = Math.max(0, perYear);
        }

        prevYear = row.year;
        prevPremium = row.premium;
    }

    return annual;
}

/**
 * 計算截至第 targetYear 退保時的 IRR
 * 現金流：
 *   - 每年年初繳保費 (負值)
 *   - 第 targetYear 年末取回 totalValue (正值)
 *
 * @param {Object} annualPremiums - year → 保費
 * @param {number} targetYear - 目標年度
 * @param {number} totalValue - 該年總現金價值
 * @returns {number} IRR (小數)
 */
function computeIRR(annualPremiums, targetYear, totalValue) {
    const cashFlows = [];
    for (let y = 1; y <= targetYear; y++) {
        const premium = annualPremiums[y] || 0;
        cashFlows.push(-premium);
    }
    // 最後一期末取回總值
    cashFlows[cashFlows.length - 1] += totalValue;

    return newtonIRR(cashFlows);
}

/**
 * 牛頓法計算 IRR
 */
function newtonIRR(cashFlows, guess = 0.05) {
    const maxIter = 200;
    const tol = 1e-7;
    let rate = guess;

    for (let i = 0; i < maxIter; i++) {
        let npv = 0;
        let dNpv = 0;
        for (let t = 0; t < cashFlows.length; t++) {
            const denom = Math.pow(1 + rate, t);
            npv += cashFlows[t] / denom;
            if (t > 0) {
                dNpv -= (t * cashFlows[t]) / Math.pow(1 + rate, t + 1);
            }
        }

        if (Math.abs(dNpv) < tol) break;

        const newRate = rate - npv / dNpv;

        if (Math.abs(newRate - rate) < tol) {
            return newRate;
        }

        // 防止發散
        if (!isFinite(newRate) || newRate < -0.99) {
            return bisectionIRR(cashFlows);
        }

        rate = newRate;
    }

    // 若未收斂，用二分法作備援
    if (!isFinite(rate)) return bisectionIRR(cashFlows);
    return rate;
}

/**
 * 二分法計算 IRR (備援方案)
 */
function bisectionIRR(cashFlows) {
    const npv = (r) => cashFlows.reduce((sum, cf, t) => sum + cf / Math.pow(1 + r, t), 0);

    let low = -0.99;
    let high = 10;
    const tol = 1e-6;

    const npvLow = npv(low);
    const npvHigh = npv(high);
    if (npvLow * npvHigh > 0) return NaN;  // 同號，無解

    for (let i = 0; i < 200; i++) {
        const mid = (low + high) / 2;
        const npvMid = npv(mid);
        if (Math.abs(npvMid) < tol) return mid;
        if (npvLow * npvMid < 0) {
            high = mid;
        } else {
            low = mid;
        }
    }

    return (low + high) / 2;
}

module.exports = { calculateMetrics, computeIRR, newtonIRR };
