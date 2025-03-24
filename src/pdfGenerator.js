/**
 * PDF Generator Module
 */
const puppeteer = require('puppeteer');

// Browser instance to reuse
let browser = null;

/**
 * Generate PDF from HTML
 * @param {string} html HTML content
 * @param {string} outputPath Output path for PDF
 */
async function generatePDF(html, outputPath) {
    if (!browser) {
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
    }

    const page = await browser.newPage();
    await page.setContent(html, {
        waitUntil: 'networkidle0'
    });

    // Configure PDF size to A4
    await page.pdf({
        path: outputPath,
        format: 'A4',
        printBackground: true,
        margin: {
            top: '20mm',
            right: '20mm',
            bottom: '20mm',
            left: '20mm'
        }
    });

    await page.close();
}

/**
 * Clean up resources
 */
function cleanup() {
    if (browser) {
        browser.close();
        browser = null;
    }
}

module.exports = {
    generatePDF,
    cleanup
}; 