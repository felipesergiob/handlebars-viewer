const vscode = require('vscode');
const express = require('express');
const handlebars = require('handlebars');
const fs = require('fs');
const path = require('path');
const open = require('open');
const os = require('os');
const { analyzeTemplate } = require('./templateAnalyzer');
const { generatePDF } = require('./pdfGenerator');

handlebars.registerHelper('helperMissing', () => '');

let server = null;
let lastCheck = Date.now();
let tempPDFPath = null;
let pdfReadyCallback = null;
let vsCodePreview = false;
let watchersSetup = false;

const startHandlebarsViewer = (document, inVSCode = false, callback = null) => {
    try {
        vsCodePreview = inVSCode;
        pdfReadyCallback = callback;

        const templatePath = document.fileName;
        const templateDir = path.dirname(templatePath);
        const templateBaseName = path.basename(templatePath, path.extname(templatePath));
        const jsonPath = path.join(templateDir, `${templateBaseName}.json`);

        tempPDFPath = path.join(os.tmpdir(), `${templateBaseName}_${Date.now()}.pdf`);

        if (!fs.existsSync(templatePath)) {
            throw new Error(`Template file not found: ${templatePath}`);
        }

        const templateContent = fs.readFileSync(templatePath, 'utf-8');

        if (!fs.existsSync(jsonPath)) {
            const data = analyzeTemplate(templateContent);
            fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));
        }

        if (server) {
            server.close();
        }

        if (vsCodePreview) {
            generatePDFAndNotify(templatePath, jsonPath);
            return;
        }

        const app = express();
        const port = 4848;

        app.use(express.static(templateDir, {
            fallthrough: true,
            setHeaders: res => {
                res.set('X-Content-Type-Options', 'nosniff');
            }
        }));

        app.use((req, res, next) => {
            if (res.statusCode === 404) {
                res.status(404).send(`
                    <div style="font-family: Arial, sans-serif; padding: 20px; text-align: center;">
                        <h2 style="color: #e74c3c;">File not found</h2>
                        <p>The file you're looking for doesn't exist or has been moved.</p>
                        <p>Please check if the file still exists in the correct location.</p>
                    </div>
                `);
                return;
            }
            next();
        });

        app.get('/pdf', (req, res) => {
            if (!fs.existsSync(tempPDFPath)) {
                return res.status(404).send(`
                    <div style="font-family: Arial, sans-serif; padding: 20px; text-align: center;">
                        <h2 style="color: #e74c3c;">PDF not found</h2>
                        <p>The PDF file has not been generated yet or an error occurred.</p>
                        <p>Please try refreshing the page.</p>
                    </div>
                `);
            }
            res.sendFile(tempPDFPath);
        });

        app.get('/', async (req, res) => {
            try {
                const templateContent = fs.readFileSync(templatePath, 'utf-8');
                const jsonContent = fs.readFileSync(jsonPath, 'utf-8');
                const data = JSON.parse(jsonContent);

                const template = handlebars.compile(templateContent);
                const html = template(data);

                await generatePDF(html, tempPDFPath);

                if (pdfReadyCallback) {
                    pdfReadyCallback(tempPDFPath);
                }

                const pageHtml = createViewerHTML(templateBaseName);
                res.send(pageHtml);
            } catch (error) {
                let statusCode = 500;
                let title = 'Error processing template';
                let message = 'An error occurred while processing the template.';

                if (error.code === 'ENOENT') {
                    statusCode = 404;
                    title = 'File not found';
                    message = 'The requested file does not exist or has been moved.';
                } else if (error.message && error.message.includes('JSON')) {
                    title = 'Invalid data format';
                    message = 'There was an error with the template data format.';
                } else if (error.message && error.message.includes('PDF')) {
                    title = 'PDF generation error';
                    message = 'An error occurred while generating the PDF preview.';
                }

                res.status(statusCode).send(`
                    <div style="font-family: Arial, sans-serif; padding: 20px; text-align: center;">
                        <h2 style="color: #e74c3c;">${title}</h2>
                        <p>${message}</p>
                        <p>Please check your template file and data.</p>
                    </div>
                `);
            }
        });

        app.get('/reload-check', (req, res) => {
            try {
                if (!fs.existsSync(templatePath) || !fs.existsSync(jsonPath)) {
                    return res.json({ reload: false, error: true });
                }

                const templateModified = fs.statSync(templatePath).mtime;
                const jsonModified = fs.statSync(jsonPath).mtime;

                if (templateModified > lastCheck || jsonModified > lastCheck) {
                    lastCheck = Date.now();

                    if (vsCodePreview && pdfReadyCallback) {
                        generatePDFAndNotify(templatePath, jsonPath);
                    }

                    res.json({ reload: true });
                } else {
                    res.json({ reload: false });
                }
            } catch (error) {
                res.json({ reload: false, error: true });
            }
        });

        server = app.listen(port, () => {
            const url = `http://localhost:${port}`;

            open(url).catch(() => {
                vscode.window.showErrorMessage('Could not open browser automatically');
            });

            vscode.window.showInformationMessage(
                `Handlebars Viewer started at ${url}`,
                'Open in Browser',
                'Open in VS Code'
            ).then(selection => {
                if (selection === 'Open in Browser') {
                    open(url).catch(() => {
                        vscode.window.showErrorMessage('Could not open browser');
                    });
                } else if (selection === 'Open in VS Code' && pdfReadyCallback) {
                    pdfReadyCallback(tempPDFPath);
                }
            });
        });

        server.on('error', error => {
            if (error.code === 'EADDRINUSE') {
                vscode.window.showErrorMessage('Port 4848 is already in use. Please close other processes that might be using this port.');
            } else {
                vscode.window.showErrorMessage(`Server error: ${error.message}`);
            }
        });
    } catch (error) {
        vscode.window.showErrorMessage(`Could not start Handlebars Viewer: ${error.message}`);
    }
};

const generatePDFAndNotify = async (templatePath, jsonPath) => {
    try {
        const templateContent = fs.readFileSync(templatePath, 'utf-8');
        const jsonContent = fs.readFileSync(jsonPath, 'utf-8');
        const data = JSON.parse(jsonContent);

        const template = handlebars.compile(templateContent);
        const html = template(data);

        const resolvedPdfPath = await generatePDF(html, tempPDFPath);

        if (resolvedPdfPath) {
            tempPDFPath = resolvedPdfPath;
        }

        if (!fs.existsSync(tempPDFPath)) {
            throw new Error('Failed to generate PDF file');
        }

        const stats = fs.statSync(tempPDFPath);
        if (stats.size === 0) {
            throw new Error('Generated PDF file is empty');
        }

        await new Promise(resolve => setTimeout(resolve, 100));

        if (pdfReadyCallback && fs.existsSync(tempPDFPath)) {
            const absolutePath = path.resolve(tempPDFPath);
            pdfReadyCallback(absolutePath);
        }

        if (!watchersSetup) {
            setupFileWatchers(templatePath, jsonPath);
        }

        return tempPDFPath;
    } catch (error) {
        vscode.window.showErrorMessage(`Error generating PDF: ${error.message}`);
        return null;
    }
};

const setupFileWatchers = (templatePath, jsonPath) => {
    try {
        watchersSetup = true;
    } catch (error) {
        // Silent fail - we'll use the VS Code extension's watchers instead
    }
};

const createViewerHTML = templateBaseName => {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Handlebars Viewer - ${templateBaseName}</title>
            <style>
                body, html {
                    margin: 0;
                    padding: 0;
                    height: 100%;
                    overflow: hidden;
                    background: #f0f0f0;
                }
                .pdf-container {
                    width: 100vw;
                    height: 100vh;
                    background: white;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                }
                iframe {
                    width: 100%;
                    height: 100%;
                    border: none;
                }
                .status {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    background: #3366CC;
                    color: white;
                    padding: 12px 24px;
                    border-radius: 8px;
                    box-shadow: 0 4px 10px rgba(51, 102, 204, 0.3);
                    display: none;
                    z-index: 1000;
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    font-weight: 500;
                    font-size: 14px;
                    letter-spacing: 0.3px;
                    transition: all 0.3s ease;
                    border-left: 4px solid #1E45A0;
                    opacity: 0.95;
                }
                .status.visible {
                    display: block;
                    animation: fadeIn 0.5s ease;
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 0.95; transform: translateY(0); }
                }
            </style>
        </head>
        <body>
            <div class="pdf-container">
                <iframe src="/pdf"></iframe>
            </div>
            <div class="status" id="status">Updating...</div>
            <script>
                const status = document.getElementById('status');
                let updateTimeout;

                function showStatus() {
                    status.textContent = 'Updating...';
                    status.classList.add('visible');
                }

                function hideStatus() {
                    status.classList.remove('visible');
                }

                setInterval(() => {
                    fetch('/reload-check')
                        .then(r => r.json())
                        .then(data => {
                            if (data.reload) {
                                showStatus();
                                clearTimeout(updateTimeout);
                                updateTimeout = setTimeout(() => {
                                    window.location.reload();
                                }, 500);
                            }
                            if (data.error) {
                                status.textContent = 'Update check failed';
                                status.classList.add('visible');
                                setTimeout(hideStatus, 3000);
                            }
                        })
                        .catch(() => {
                            status.textContent = 'Connection error';
                            status.classList.add('visible');
                            setTimeout(hideStatus, 3000);
                        });
                }, 1000);
            </script>
        </body>
        </html>
    `;
};

const cleanup = () => {
    if (server) {
        server.close();
        server = null;
    }

    if (tempPDFPath && fs.existsSync(tempPDFPath)) {
        try {
            fs.unlinkSync(tempPDFPath);
        } catch (error) {
            // Silent cleanup failure
        }
    }
};

module.exports = {
    startHandlebarsViewer,
    cleanup
};
