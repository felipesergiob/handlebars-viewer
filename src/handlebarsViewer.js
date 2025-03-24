/**
 * Handlebars Viewer Module
 */
const vscode = require('vscode');
const express = require('express');
const handlebars = require('handlebars');
const fs = require('fs');
const path = require('path');
const open = require('open');
const os = require('os');
const { analyzeTemplate } = require('./templateAnalyzer');
const { generatePDF } = require('./pdfGenerator');

// Configure Handlebars to not fail when a helper is missing
handlebars.registerHelper('helperMissing', function(/* dynamic arguments */) {
    // Return empty string instead of throwing an error
    return '';
});

// Server instance
let server = null;
let lastCheck = Date.now();
let tempPDFPath = null;

/**
 * Start Handlebars template viewer
 * @param {vscode.TextDocument} document Document to preview
 */
function startHandlebarsViewer(document) {
    const templatePath = document.fileName;
    const templateDir = path.dirname(templatePath);
    const templateBaseName = path.basename(templatePath, path.extname(templatePath));
    const jsonPath = path.join(templateDir, `${templateBaseName}.json`);
    
    // Create PDF in temporary directory
    tempPDFPath = path.join(os.tmpdir(), `${templateBaseName}_${Date.now()}.pdf`);

    // Read template content
    const templateContent = fs.readFileSync(templatePath, 'utf-8');

    // Create JSON file if it doesn't exist
    if (!fs.existsSync(jsonPath)) {
        const data = analyzeTemplate(templateContent);
        fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));
    }

    // Stop existing server if there is one
    if (server) {
        server.close();
    }

    // Create new server
    const app = express();
    const port = 4848;

    // Serve static files
    app.use(express.static(templateDir));

    // Route to serve PDF
    app.get('/pdf', (req, res) => {
        res.sendFile(tempPDFPath);
    });

    // Main route
    app.get('/', async (req, res) => {
        try {
            const templateContent = fs.readFileSync(templatePath, 'utf-8');
            const jsonContent = fs.readFileSync(jsonPath, 'utf-8');
            const data = JSON.parse(jsonContent);
            
            const template = handlebars.compile(templateContent);
            const html = template(data);
            
            await generatePDF(html, tempPDFPath);
            
            // Create HTML page with PDF viewer
            const pageHtml = createViewerHTML(templateBaseName);
            
            res.send(pageHtml);
        } catch (error) {
            res.status(500).send(`<h1>Error rendering template</h1><pre>${error.stack}</pre>`);
        }
    });

    // Route to check for updates
    app.get('/reload-check', (req, res) => {
        const templateModified = fs.statSync(templatePath).mtime;
        const jsonModified = fs.statSync(jsonPath).mtime;
        
        if (templateModified > lastCheck || jsonModified > lastCheck) {
            lastCheck = Date.now();
            res.json({ reload: true });
        } else {
            res.json({ reload: false });
        }
    });

    // Start server
    server = app.listen(port, () => {
        const url = `http://localhost:${port}`;
        
        open(url);
        
        vscode.window.showInformationMessage(
            `Handlebars Viewer started at ${url}`,
            'Open in Browser'
        ).then(selection => {
            if (selection === 'Open in Browser') {
                open(url);
            }
        });
    });

    // Handle server errors
    server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
            vscode.window.showErrorMessage('Port 4848 is already in use. Please close other processes that might be using this port.');
        } else {
            vscode.window.showErrorMessage('Error starting server: ' + error.message);
        }
    });
}

/**
 * Create HTML for the viewer page
 * @param {string} templateBaseName Base name of the template
 * @returns {string} HTML content
 */
function createViewerHTML(templateBaseName) {
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
                    fetch('/reload-check').then(r => r.json()).then(data => {
                        if (data.reload) {
                            showStatus();
                            clearTimeout(updateTimeout);
                            updateTimeout = setTimeout(() => {
                                window.location.reload();
                            }, 500);
                        }
                    });
                }, 1000);
            </script>
        </body>
        </html>
    `;
}

/**
 * Clean up resources
 */
function cleanup() {
    if (server) {
        server.close();
        server = null;
    }

    // Clean up temporary PDF file
    if (tempPDFPath && fs.existsSync(tempPDFPath)) {
        try {
            fs.unlinkSync(tempPDFPath);
        } catch (error) {
            // Silent cleanup failure
        }
    }
}

module.exports = {
    startHandlebarsViewer,
    cleanup
}; 