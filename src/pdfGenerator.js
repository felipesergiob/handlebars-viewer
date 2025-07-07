const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
let browser = null;

const generatePDF = async (html, outputPath) => {
    if (!html || !outputPath) {
        throw new Error('Missing required parameters for PDF generation');
    }

    outputPath = path.normalize(outputPath).replace(/\\/g, '/');

    try {
        if (!browser || !browser.isConnected()) {
            browser = await puppeteer.launch({
                headless: 'new',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas'
                ]
            });
        }

        const page = await browser.newPage();

        try {
            await page.setViewport({
                width: 800,
                height: 1120,
                deviceScaleFactor: 1
            });

            await page.setDefaultNavigationTimeout(30000);

            await page.setContent(html, {
                waitUntil: 'networkidle0',
                timeout: 30000
            });

            const pdfDir = path.dirname(outputPath);
            if (pdfDir && !fs.existsSync(pdfDir)) {
                fs.mkdirSync(pdfDir, { recursive: true });
            }

            const pdfBuffer = await page.pdf({
                path: outputPath,
                format: 'A4',
                printBackground: true,
                margin: {
                    top: '20mm',
                    right: '20mm',
                    bottom: '20mm',
                    left: '20mm'
                },
                preferCSSPageSize: true
            });

            if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
                fs.writeFileSync(outputPath, pdfBuffer);

                if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
                    throw new Error('Generated PDF file is empty or not accessible');
                }
            }

            return path.resolve(outputPath);
        } catch (error) {
            throw new Error(`PDF generation failed: ${error.message}`);
        } finally {
            await page.close().catch(() => {});
        }
    } catch (error) {
        if (browser) {
            await browser.close().catch(() => {});
            browser = null;
        }
        throw error;
    }
};

const cleanup = () => {
    if (browser) {
        browser.close()
            .catch(() => {})
            .finally(() => {
                browser = null;
            });
    }
};

module.exports = {
    generatePDF,
    cleanup
};
