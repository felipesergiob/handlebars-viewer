const vscode = require('vscode');
const { startHandlebarsViewer, cleanup } = require('./handlebarsViewer');
const { cleanup: cleanupPDF } = require('./pdfGenerator');
const fs = require('fs');
const path = require('path');

let statusBarItem = null;
let pdfPanel = null;
let currentPdfPath = null;
let fileWatcher = null;
let jsonWatcher = null;
let lastContentHash = null;

const activate = context => {
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = "$(file-pdf) Handlebars Viewer";
    statusBarItem.tooltip = "Preview Handlebars Template as PDF";
    statusBarItem.command = 'handlebarsViewer.preview';
    statusBarItem.show();

    const previewCommand = vscode.commands.registerCommand('handlebarsViewer.preview', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No file open');
            return;
        }

        const document = editor.document;
        if (!document.fileName.endsWith('.hbs') && !document.fileName.endsWith('.handlebars')) {
            vscode.window.showErrorMessage('Please open a .hbs or .handlebars file');
            return;
        }

        try {
            await document.save();

            const option = await vscode.window.showQuickPick([
                { label: 'VS Code Panel', description: 'Preview in VS Code sidebar panel' },
                { label: 'Browser', description: 'Preview in web browser' }
            ], {
                placeHolder: 'Select preview method'
            });

            if (!option) return;

            if (option.label === 'VS Code Panel') {
                startHandlebarsViewer(document, true, pdfPath => {
                    showPdfPreview(context, pdfPath, document.fileName);
                });
            } else {
                startHandlebarsViewer(document, false);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Error: ${error.message}`);
        }
    });

    const openInPanelCommand = vscode.commands.registerCommand('handlebarsViewer.openInPanel', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || (!editor.document.fileName.endsWith('.hbs') && !editor.document.fileName.endsWith('.handlebars'))) {
            vscode.window.showErrorMessage('Please open a Handlebars template file first');
            return;
        }

        try {
            await editor.document.save();
            startHandlebarsViewer(editor.document, true, pdfPath => {
                showPdfPreview(context, pdfPath, editor.document.fileName);
            });
        } catch (error) {
            vscode.window.showErrorMessage(`Error: ${error.message}`);
        }
    });

    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor && (editor.document.fileName.endsWith('.hbs') || editor.document.fileName.endsWith('.handlebars'))) {
                statusBarItem.show();
            } else {
                statusBarItem.hide();
            }
        })
    );

    context.subscriptions.push(previewCommand, openInPanelCommand);
};

const showPdfPreview = (context, pdfPath, sourceFile) => {
    currentPdfPath = pdfPath;

    if (pdfPanel) {
        pdfPanel.dispose();
    }

    if (fileWatcher) {
        fileWatcher.dispose();
    }
    if (jsonWatcher) {
        jsonWatcher.dispose();
    }

    if (!fs.existsSync(pdfPath)) {
        vscode.window.showErrorMessage(`Cannot find PDF file: ${pdfPath}`);
        return;
    }

    pdfPanel = vscode.window.createWebviewPanel(
        'handlebarsViewer',
        'Handlebars PDF Preview',
        vscode.ViewColumn.Beside,
        {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [
                vscode.Uri.file(path.dirname(pdfPath))
            ]
        }
    );

    const templateDir = path.dirname(sourceFile);
    const templateBaseName = path.basename(sourceFile, path.extname(sourceFile));
    const jsonPath = path.join(templateDir, `${templateBaseName}.json`);

    fileWatcher = vscode.workspace.createFileSystemWatcher(sourceFile);
    jsonWatcher = vscode.workspace.createFileSystemWatcher(jsonPath);

    const refreshPdfView = () => {
        if (pdfPanel && fs.existsSync(currentPdfPath)) {
            try {
                const documentPath = vscode.Uri.file(sourceFile);

                if (!fs.existsSync(sourceFile)) {
                    vscode.window.showErrorMessage(`Arquivo template não encontrado: ${sourceFile}`);
                    pdfPanel.webview.postMessage({ command: 'refreshFailed' });
                    return;
                }

                const fileContent = fs.readFileSync(sourceFile, 'utf-8');
                const templateDir = path.dirname(sourceFile);
                const templateBaseName = path.basename(sourceFile, path.extname(sourceFile));
                const jsonPath = path.join(templateDir, `${templateBaseName}.json`);
                let jsonContent = '';

                if (fs.existsSync(jsonPath)) {
                    jsonContent = fs.readFileSync(jsonPath, 'utf-8');
                }

                const fullContentHash = hashString(fileContent + jsonContent);

                if (lastContentHash === fullContentHash) {
                    vscode.window.setStatusBarMessage('Nenhuma alteração detectada', 2000);
                    return;
                }

                lastContentHash = fullContentHash;

                pdfPanel.webview.postMessage({ command: 'startRefresh' });

                vscode.workspace.openTextDocument(documentPath)
                    .then(document => {
                        if (!document) {
                            vscode.window.showErrorMessage('Não foi possível abrir o arquivo template.');
                            pdfPanel.webview.postMessage({ command: 'refreshFailed' });
                            return;
                        }

                        startHandlebarsViewer(document, true, newPdfPath => {
                            if (newPdfPath && newPdfPath !== currentPdfPath) {
                                currentPdfPath = newPdfPath;
                            }

                            setTimeout(() => {
                                if (pdfPanel && fs.existsSync(currentPdfPath)) {
                                    const pdfUri = vscode.Uri.file(currentPdfPath);
                                    const webviewPdfUri = pdfPanel.webview.asWebviewUri(pdfUri);

                                    pdfPanel.webview.html = getPdfJsViewerHtml(webviewPdfUri.toString(), true);
                                    vscode.window.setStatusBarMessage('PDF atualizado com sucesso', 2000);
                                } else {
                                    if (pdfPanel) {
                                        pdfPanel.webview.postMessage({ command: 'refreshFailed' });
                                    }
                                }
                            }, 500);
                        });
                    })
                    .catch(error => {
                        vscode.window.showErrorMessage(`Erro ao atualizar PDF: ${error.message}`);

                        if (pdfPanel) {
                            pdfPanel.webview.postMessage({ command: 'refreshFailed' });
                        }
                    });
            } catch (error) {
                vscode.window.showErrorMessage(`Erro ao atualizar PDF: ${error.message}`);

                if (pdfPanel) {
                    pdfPanel.webview.postMessage({ command: 'refreshFailed' });
                }
            }
        }
    };

    fileWatcher.onDidChange(() => refreshPdfView());
    jsonWatcher.onDidChange(() => refreshPdfView());

    const pdfUri = vscode.Uri.file(pdfPath);
    const webviewPdfUri = pdfPanel.webview.asWebviewUri(pdfUri);

    pdfPanel.webview.html = getPdfJsViewerHtml(webviewPdfUri.toString());

    pdfPanel.onDidDispose(() => {
        pdfPanel = null;
        if (fileWatcher) {
            fileWatcher.dispose();
            fileWatcher = null;
        }
        if (jsonWatcher) {
            jsonWatcher.dispose();
            jsonWatcher = null;
        }
    }, null, context.subscriptions);

    pdfPanel.webview.onDidReceiveMessage(
        message => {
            switch (message.command) {
                case 'openExternal':
                    openExternalPdf(currentPdfPath);
                    return;

                case 'viewFallback':
                    pdfPanel.webview.html = getFallbackViewerHtml(pdfPath);
                    return;

                case 'checkForUpdates':
                    try {
                        const templateStat = fs.statSync(sourceFile);
                        const templateDir = path.dirname(sourceFile);
                        const templateBaseName = path.basename(sourceFile, path.extname(sourceFile));
                        const jsonPath = path.join(templateDir, `${templateBaseName}.json`);

                        if (fs.existsSync(jsonPath)) {
                            const jsonStat = fs.statSync(jsonPath);
                            const lastModifiedSource = templateStat.mtime.getTime();
                            const lastModifiedJson = jsonStat.mtime.getTime();

                            const now = Date.now();
                            if ((now - lastModifiedSource < 5000) || (now - lastModifiedJson < 5000)) {
                                pdfPanel.webview.postMessage({ command: 'refresh' });
                            }
                        }
                    } catch (error) {
                        // ignore error
                    }
                    return;
            }
        },
        undefined,
        context.subscriptions
    );
};

const getPdfJsViewerHtml = (pdfUri, refresh = false) => {
    const timestamp = refresh ? `?t=${new Date().getTime()}` : '';

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Handlebars PDF Preview</title>
            <script src="https://cdn.jsdelivr.net/npm/pdfjs-dist@3.3.122/build/pdf.min.js"></script>
            <style>
                body, html {
                    margin: 0;
                    padding: 0;
                    height: 100%;
                    overflow: hidden;
                    background-color: #303030;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                }
                #pdfContainer {
                    position: absolute;
                    top: 0;
                    right: 0;
                    bottom: 0;
                    left: 0;
                    overflow: auto;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    padding: 10px;
                }
                .page {
                    margin-bottom: 8px;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.3);
                    background-color: white;
                    max-width: 100%;
                }
                #toolbar {
                    position: fixed;
                    bottom: 10px;
                    right: 10px;
                    z-index: 100;
                    display: flex;
                    gap: 8px;
                    background: rgba(0,0,0,0.6);
                    padding: 5px 8px;
                    border-radius: 4px;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.2);
                    backdrop-filter: blur(4px);
                }
                .controls {
                    position: fixed;
                    top: 10px;
                    right: 10px;
                    z-index: 100;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    background: rgba(0,0,0,0.6);
                    padding: 6px 10px;
                    border-radius: 20px;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.2);
                    backdrop-filter: blur(4px);
                }
                button {
                    background-color: #007acc;
                    color: white;
                    border: none;
                    padding: 6px 10px;
                    font-size: 12px;
                    border-radius: 3px;
                    cursor: pointer;
                    transition: background-color 0.2s;
                    opacity: 0.9;
                }
                button:hover {
                    background-color: #005fa3;
                    opacity: 1;
                }
                .zoom-btn {
                    width: 24px;
                    height: 24px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 50%;
                    font-weight: bold;
                    padding: 0;
                }
                .zoom-value {
                    color: white;
                    font-size: 12px;
                    min-width: 40px;
                    text-align: center;
                }
                .loading {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    color: #ddd;
                    text-align: center;
                }
                .loading-spinner {
                    width: 40px;
                    height: 40px;
                    margin: 0 auto 15px;
                    border: 3px solid #555;
                    border-top: 3px solid #fff;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                .error-message {
                    background-color: white;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    padding: 20px;
                    max-width: 90%;
                    margin: 100px auto;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    display: none;
                    text-align: center;
                }
                .fit-width .page {
                    width: 100% !important;
                    height: auto !important;
                }
                .page-info {
                    position: fixed;
                    bottom: 10px;
                    left: 10px;
                    z-index: 100;
                    background: rgba(0,0,0,0.6);
                    color: white;
                    padding: 4px 10px;
                    border-radius: 20px;
                    font-size: 12px;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.2);
                    backdrop-filter: blur(4px);
                }
                .update-notification {
                    position: fixed;
                    bottom: 20px;
                    left: 50%;
                    transform: translateX(-50%);
                    z-index: 1000;
                    background: #3366CC;
                    color: white;
                    padding: 10px 20px;
                    border-radius: 20px;
                    box-shadow: 0 4px 10px rgba(51, 102, 204, 0.3);
                    font-size: 13px;
                    display: none;
                    align-items: center;
                    gap: 10px;
                    animation: fadeIn 0.3s ease;
                    backdrop-filter: blur(4px);
                    border-left: 4px solid #1E45A0;
                }
                .update-notification.visible {
                    display: flex;
                }
                .update-spinner {
                    width: 16px;
                    height: 16px;
                    border: 2px solid rgba(255,255,255,0.3);
                    border-top: 2px solid white;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translate(-50%, 10px); }
                    to { opacity: 1; transform: translate(-50%, 0); }
                }
                @keyframes fadeOut {
                    from { opacity: 1; transform: translate(-50%, 0); }
                    to { opacity: 0; transform: translate(-50%, 10px); }
                }
                .fade-out {
                    animation: fadeOut 0.3s ease forwards;
                }
            </style>
        </head>
        <body>
            <div class="loading" id="loading">
                <div class="loading-spinner"></div>
                <div>Loading PDF...</div>
            </div>

            <div id="pdfContainer"></div>

            <div class="controls" id="controls">
                <button class="zoom-btn" id="zoomOut">-</button>
                <span class="zoom-value" id="zoomValue">100%</span>
                <button class="zoom-btn" id="zoomIn">+</button>
                <button id="fitWidth">Fit</button>
            </div>

            <div class="page-info" id="pageInfo">Loading...</div>

            <div class="update-notification" id="updateNotification">
                <div class="update-spinner"></div>
                <span>Atualizando PDF...</span>
            </div>

            <div class="error-message" id="errorMessage">
                <h3>Error Displaying PDF</h3>
                <p>There was a problem displaying the PDF. Try using the system's PDF viewer instead.</p>
                <button id="fallbackBtn">Use Simple Viewer</button>
                <button id="openExternalBtn">Open in Default App</button>
            </div>

            <div id="toolbar">
                <button id="openBtn">Open Externally</button>
            </div>

            <script>
                pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.3.122/build/pdf.worker.min.js';

                const vscode = acquireVsCodeApi();
                const pdfUrl = "${pdfUri}${timestamp}";
                const container = document.getElementById('pdfContainer');
                const loading = document.getElementById('loading');
                const errorMessage = document.getElementById('errorMessage');
                const openBtn = document.getElementById('openBtn');
                const fallbackBtn = document.getElementById('fallbackBtn');
                const openExternalBtn = document.getElementById('openExternalBtn');
                const zoomIn = document.getElementById('zoomIn');
                const zoomOut = document.getElementById('zoomOut');
                const zoomValue = document.getElementById('zoomValue');
                const fitWidth = document.getElementById('fitWidth');
                const pageInfo = document.getElementById('pageInfo');
                const updateNotification = document.getElementById('updateNotification');

                if ("${refresh}" === "true") {
                    showUpdateNotification();

                    setTimeout(() => {
                        if (updateNotification.classList.contains('visible')) {
                            hideUpdateNotification();
                            console.log('Timeout de segurança ativado para evitar loading infinito');
                        }
                    }, 5000);
                }

                function showUpdateNotification() {
                    updateNotification.classList.remove('fade-out');
                    updateNotification.classList.add('visible');
                    updateNotification.dataset.visibleSince = Date.now().toString();

                    setTimeout(() => {
                        if (updateNotification.classList.contains('visible')) {
                            hideUpdateNotification();
                        }
                    }, 5000);
                }

                function hideUpdateNotification() {
                    updateNotification.classList.add('fade-out');
                    setTimeout(() => {
                        updateNotification.classList.remove('visible');
                        updateNotification.classList.remove('fade-out');
                    }, 300);
                }

                openBtn.addEventListener('click', () => {
                    vscode.postMessage({ command: 'openExternal' });
                });

                fallbackBtn.addEventListener('click', () => {
                    vscode.postMessage({ command: 'viewFallback' });
                });

                openExternalBtn.addEventListener('click', () => {
                    vscode.postMessage({ command: 'openExternal' });
                });

                const state = vscode.getState() || { scale: 1.0 };

                let currentPdf = null;
                let currentScale = state.scale || 1.0;
                let pagesRendered = 0;
                let totalPages = 0;

                function updateZoomUI() {
                    if (currentScale === 'auto') {
                        zoomValue.textContent = 'Fit';
                    } else {
                        zoomValue.textContent = \`\${Math.round(currentScale * 100)}%\`;
                    }

                    vscode.setState({ scale: currentScale });
                }

                updateZoomUI();

                zoomIn.addEventListener('click', () => {
                    if (currentScale === 'auto') {
                        currentScale = 1.0;
                    } else {
                        currentScale = Math.min(2.0, currentScale + 0.25);
                    }
                    updateZoomUI();
                    resetAndRender();
                });

                zoomOut.addEventListener('click', () => {
                    if (currentScale === 'auto') {
                        currentScale = 0.75;
                    } else {
                        currentScale = Math.max(0.25, currentScale - 0.25);
                    }
                    updateZoomUI();
                    resetAndRender();
                });

                fitWidth.addEventListener('click', () => {
                    currentScale = 'auto';
                    container.classList.add('fit-width');
                    updateZoomUI();
                    resetAndRender();
                });

                function resetAndRender() {
                    container.innerHTML = '';
                    pagesRendered = 0;

                    if (currentScale === 'auto') {
                        container.classList.add('fit-width');
                    } else {
                        container.classList.remove('fit-width');
                    }

                    loadVisiblePages();
                }

                pdfjsLib.getDocument(pdfUrl).promise
                    .then(pdf => {
                        loading.style.display = 'none';
                        currentPdf = pdf;
                        totalPages = pdf.numPages;

                        updatePageInfo(0, totalPages);

                        const containerWidth = container.clientWidth;
                        if (containerWidth < 500 && currentScale !== 'auto' && !state.scale) {
                            currentScale = 'auto';
                            container.classList.add('fit-width');
                            updateZoomUI();
                        }

                        loadVisiblePages();

                        container.addEventListener('scroll', loadVisiblePages);

                        if (updateNotification.classList.contains('visible')) {
                            hideUpdateNotification();
                        }
                    })
                    .catch(error => {
                        loading.style.display = 'none';
                        errorMessage.style.display = 'block';
                        console.error('Error loading PDF:', error);
                    });

                function loadVisiblePages() {
                    if (!currentPdf) return;

                    if (pagesRendered === 0) {
                        for (let i = 1; i <= Math.min(totalPages, 2); i++) {
                            renderPage(currentPdf, i);
                            pagesRendered++;
                        }
                        updatePageInfo(pagesRendered, totalPages);

                        if (updateNotification.classList.contains('visible')) {
                            hideUpdateNotification();
                        }

                        return;
                    }

                    if (pagesRendered >= totalPages) return;

                    const scrollPos = container.scrollTop + container.clientHeight;
                    const scrollHeight = container.scrollHeight;

                    if (scrollPos >= scrollHeight - 300 && pagesRendered < totalPages) {
                        renderPage(currentPdf, pagesRendered + 1);
                        pagesRendered++;
                        updatePageInfo(pagesRendered, totalPages);
                    }
                }

                function updatePageInfo(current, total) {
                    pageInfo.textContent = \`Página \${current} de \${total}\`;
                }

                function renderPage(pdf, pageNumber) {
                    pdf.getPage(pageNumber).then(page => {
                        let scale = parseFloat(currentScale);

                        if (isNaN(scale)) {
                            const viewport = page.getViewport({ scale: 1.0 });
                            const containerWidth = container.clientWidth - 20;
                            scale = containerWidth / viewport.width;
                        }

                        const viewport = page.getViewport({ scale });

                        const canvas = document.createElement('canvas');
                        canvas.className = 'page';
                        canvas.dataset.pageNumber = pageNumber;
                        container.appendChild(canvas);

                        const context = canvas.getContext('2d');
                        canvas.height = viewport.height;
                        canvas.width = viewport.width;

                        page.render({
                            canvasContext: context,
                            viewport: viewport
                        });
                    });
                }

                window.addEventListener('resize', () => {
                    if (currentScale === 'auto') {
                        container.innerHTML = '';
                        pagesRendered = 0;
                        loadVisiblePages();
                    }
                });

                function setupAutoRefresh() {
                    setInterval(() => {
                        vscode.postMessage({ command: 'checkForUpdates' });
                    }, 2000);
                }

                setupAutoRefresh();

                window.addEventListener('message', event => {
                    const message = event.data;
                    if (message.command === 'refresh') {
                        showUpdateNotification();
                    } else if (message.command === 'startRefresh') {
                        showUpdateNotification();
                    } else if (message.command === 'refreshFailed') {
                        hideUpdateNotification();
                    }
                });

                setInterval(() => {
                    if (updateNotification.classList.contains('visible')) {
                        const visibleTime = parseInt(updateNotification.dataset.visibleSince || '0');
                        const now = Date.now();
                        if (now - visibleTime > 10000) { // 10 segundos
                            console.log('Timeout global de segurança: loading ficou visível por mais de 10 segundos');
                            hideUpdateNotification();
                        }
                    }
                }, 5000); // Verificar a cada 5 segundos
            </script>
        </body>
        </html>
    `;
};

const getFallbackViewerHtml = pdfPath => {
    const fileName = path.basename(pdfPath);
    const lastModified = fs.statSync(pdfPath).mtime.toLocaleString();
    const fileSize = (fs.statSync(pdfPath).size / 1024).toFixed(1) + ' KB';

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Handlebars PDF Preview</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                    padding: 20px;
                    color: #333;
                    line-height: 1.5;
                    text-align: center;
                    background-color: #f3f3f3;
                }
                .container {
                    max-width: 600px;
                    margin: 0 auto;
                    background: white;
                    border-radius: 8px;
                    padding: 24px;
                    box-shadow: 0 4px 8px rgba(0,0,0,0.05);
                }
                h2 {
                    margin-top: 0;
                    color: #333;
                }
                .file-info {
                    text-align: left;
                    background: #f9f9f9;
                    padding: 15px;
                    border-radius: 4px;
                    margin: 20px 0;
                    border-left: 4px solid #007acc;
                }
                .file-name {
                    font-weight: bold;
                    font-size: 16px;
                    margin-bottom: 5px;
                    word-break: break-all;
                }
                .file-details {
                    font-size: 14px;
                    color: #666;
                }
                button {
                    background-color: #007acc;
                    color: white;
                    border: none;
                    padding: 12px 20px;
                    font-size: 16px;
                    border-radius: 4px;
                    cursor: pointer;
                    transition: background-color 0.2s;
                    margin: 10px 5px;
                }
                button:hover {
                    background-color: #005fa3;
                }
                .note {
                    font-size: 14px;
                    color: #666;
                    margin-top: 20px;
                    font-style: italic;
                }
                .pdf-icon {
                    font-size: 48px;
                    margin-bottom: 20px;
                    color: #e74c3c;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="pdf-icon">📄</div>
                <h2>PDF Generated Successfully</h2>

                <div class="file-info">
                    <div class="file-name">${fileName}</div>
                    <div class="file-details">
                        <div>Size: ${fileSize}</div>
                        <div>Last Modified: ${lastModified}</div>
                    </div>
                </div>

                <button id="openBtn">Open PDF in Default Viewer</button>
                <button id="tryViewerBtn">Try PDF.js Viewer</button>

                <p class="note">
                    PDF.js viewer may not be compatible with your current VS Code environment.
                    The default viewer option is more reliable.
                </p>
            </div>

            <script>
                const vscode = acquireVsCodeApi();
                const openBtn = document.getElementById('openBtn');
                const tryViewerBtn = document.getElementById('tryViewerBtn');

                openBtn.addEventListener('click', () => {
                    vscode.postMessage({
                        command: 'openExternal'
                    });
                });

                tryViewerBtn.addEventListener('click', () => {
                    location.reload();
                });
            </script>
        </body>
        </html>
    `;
};

const openExternalPdf = pdfPath => {
    const open = require('open');
    open(pdfPath).catch(error => {
        vscode.window.showErrorMessage(`Failed to open PDF: ${error.message}`);
    });
};

const deactivate = () => {
    cleanup();
    cleanupPDF();

    if (fileWatcher) {
        fileWatcher.dispose();
    }

    if (jsonWatcher) {
        jsonWatcher.dispose();
    }

    if (pdfPanel) {
        pdfPanel.dispose();
    }

    if (statusBarItem) {
        statusBarItem.dispose();
    }
};

function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash;
}

module.exports = {
    activate,
    deactivate
};
