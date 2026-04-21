// OCR 模組：支援 PDF 和圖片
// 使用 tesseract.js (純 JS，相容 Netlify Functions)

const Tesseract = require('tesseract.js');

/**
 * 執行 OCR 辨識
 * @param {Buffer} fileBuffer - 檔案 Buffer
 * @param {string} mimetype - MIME type
 * @returns {Promise<string>} 辨識出的文字
 */
async function performOCR(fileBuffer, mimetype) {
    let imageBuffer = fileBuffer;

    // 若是 PDF，先轉成圖片
    if (mimetype === 'application/pdf') {
        imageBuffer = await convertPdfToImage(fileBuffer);
    }

    const { data: { text } } = await Tesseract.recognize(
        imageBuffer,
        'chi_tra+eng',
        {
            logger: m => {
                if (m.status === 'recognizing text') {
                    console.log(`[OCR] ${m.status}: ${Math.round(m.progress * 100)}%`);
                }
            }
        }
    );

    return text;
}

/**
 * 將 PDF 轉成圖片 (第一頁)
 * 使用 pdfjs-dist (純 JS)
 */
async function convertPdfToImage(pdfBuffer) {
    // 動態載入 pdfjs-dist (避免在不需要時載入)
    const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
    const { createCanvas } = require('canvas');

    const uint8Array = new Uint8Array(pdfBuffer);
    const pdfDoc = await pdfjsLib.getDocument({ data: uint8Array, disableFontFace: true }).promise;

    // 只處理前 3 頁以控制時間
    const numPages = Math.min(pdfDoc.numPages, 3);
    const allBuffers = [];

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: 2.0 });

        const canvas = createCanvas(viewport.width, viewport.height);
        const context = canvas.getContext('2d');

        await page.render({
            canvasContext: context,
            viewport: viewport,
            canvasFactory: {
                create: (w, h) => {
                    const c = createCanvas(w, h);
                    return { canvas: c, context: c.getContext('2d') };
                },
                reset: (canvasAndContext, w, h) => {
                    canvasAndContext.canvas.width = w;
                    canvasAndContext.canvas.height = h;
                },
                destroy: (canvasAndContext) => {
                    canvasAndContext.canvas.width = 0;
                    canvasAndContext.canvas.height = 0;
                }
            }
        }).promise;

        allBuffers.push(canvas.toBuffer('image/png'));
    }

    // 簡化：回傳第一頁 (多頁的完整實作可後續優化)
    return allBuffers[0];
}

module.exports = { performOCR };
