const assert = require('assert');
const vscode = require('vscode');

suite('Handlebars Viewer Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Extension should be present', () => {
		assert.ok(vscode.extensions.getExtension('handlebars-viewer'));
	});

	test('Should activate', async () => {
		const extension = vscode.extensions.getExtension('handlebars-viewer');
		await extension.activate();
		assert.strictEqual(extension.isActive, true);
	});

	test('Should register commands', () => {
		const commands = vscode.commands.getCommands();
		assert.ok(commands.includes('handlebarsViewer.preview'));
		assert.ok(commands.includes('handlebarsViewer.openInPanel'));
	});

	test('Sample test', () => {
		assert.strictEqual(-1, [1, 2, 3].indexOf(5));
		assert.strictEqual(-1, [1, 2, 3].indexOf(0));
	});
});
