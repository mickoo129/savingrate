// Netlify Serverless Function: 保單分析 (輕量版)
// 職責：接收前端已提取的文字 → 解析保單數據 → 計算 IRR → 回傳 JSON
// 零原生依賴，保證 Netlify build 成功

const { parsePolicyText } = require('./lib/parser');
const { calculateMetrics } = require('./lib/calculator');

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: '只允許 POST 請求' })
        };
    }

    try {
        const payload = JSON.parse(event.body || '{}');
        const { text } = payload;

        if (!text || typeof text !== 'string') {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: '沒有收到文字內容' })
            };
        }

        console.log(`[analyze] 收到文字 ${text.length} 字元`);

        // 解析保單數據
        const policyData = parsePolicyText(text);
        console.log(`[analyze] 解析出 ${policyData.length} 筆保單年度數據`);

        if (policyData.length === 0) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    data: [],
                    error: '未能從文件中解析出保單數據'
                })
            };
        }

        // 計算 IRR
        const results = calculateMetrics(policyData);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                data: results,
                count: results.length
            })
        };
    } catch (error) {
        console.error('[analyze] 錯誤：', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: error.message || '伺服器內部錯誤'
            })
        };
    }
};
