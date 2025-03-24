/**
 * Handlebars Viewer Extension
 * VS Code extension for previewing Handlebars templates with auto-generated data
 */
const vscode = require('vscode');
const { startHandlebarsViewer, cleanup } = require('./handlebarsViewer');
const { cleanup: cleanupPDF } = require('./pdfGenerator');

// Status bar item
let statusBarItem = null;

/**
 * Extension activation function
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    // Create status bar button
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = "$(file-pdf) Handlebars Viewer";
    statusBarItem.tooltip = "Preview Handlebars Template as PDF";
    statusBarItem.command = 'handlebarsViewer.preview';
    statusBarItem.show();
    
    // Register command
    let disposable = vscode.commands.registerCommand('handlebarsViewer.preview', async () => {
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
            startHandlebarsViewer(document);
        } catch (error) {
            vscode.window.showErrorMessage('Error saving file: ' + error.message);
        }
    });
    
    // Update button visibility when editor changes
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor && (editor.document.fileName.endsWith('.hbs') || editor.document.fileName.endsWith('.handlebars'))) {
                statusBarItem.show();
            } else {
                statusBarItem.hide();
            }
        })
    );
    
    context.subscriptions.push(disposable);
}

/**
 * Function called when the extension is deactivated
 */
function deactivate() {
    cleanup();
    cleanupPDF();
    
    if (statusBarItem) {
        statusBarItem.dispose();
    }
}

module.exports = {
    activate,
    deactivate
}; 