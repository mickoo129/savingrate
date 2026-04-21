// Netlify Serverless Function: 保單分析
// 接收上傳的 PDF 或圖片，使用 OCR 辨識，解析保單數據，並計算 IRR

const { performOCR } = require('./lib/ocr');
const { parsePolicyText } = require('./lib/parser');
const { calculateMetrics } = require('./lib/calculator');

exports.handler = async (event) => {
    // CORS headers
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
        const { filename, mimetype, data } = payload;

        if (!data) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: '沒有收到檔案內容' })
            };
        }

        const fileBuffer = Buffer.from(data, 'base64');
        console.log(`[analyze] 收到檔案：${filename} (${mimetype}), 大小 ${fileBuffer.length} bytes`);

        // 1. OCR 辨識
        const text = await performOCR(fileBuffer, mimetype);
        console.log(`[analyze] OCR 完成，文字長度 ${text.length}`);

        // 2. 解析保單數據
        const policyData = parsePolicyText(text);
        console.log(`[analyze] 解析出 ${policyData.length} 筆保單年度數據`);

        if (policyData.length === 0) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    data: [],
                    rawText: text.substring(0, 500),
                    error: '未能從文件中解析出保單數據'
                })
            };
        }

        // 3. 計算 IRR 等指標
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
