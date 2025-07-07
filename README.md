# Handlebars Viewer for VS Code

Simple Handlebars template viewer with real data.

## Features

- 👁️ **Real-time preview** - See your Handlebars templates rendered with real data
- 🔄 **Auto-refresh** - Changes to template or data are automatically updated
- 🖱️ **Easy to use** - A status bar button, similar to Live Server
- 📊 **Custom helpers support** - Use built-in and custom Handlebars helpers
- 🎨 **Side panel preview** - View templates in VS Code's side panel

## How to use

### 1. Open a .hbs or .handlebars file

### 2. Click the "Handlebars" button in the status bar (bottom of VS Code)

Or use:
- The context menu (right-click) and select "Preview Handlebars Template"
- The command palette (Ctrl+Shift+P or Cmd+Shift+P) and type "Handlebars"

### 3. Your browser will automatically open showing the rendered template

The extension will look for a JSON file with the same name as your template to provide the data. For example, for `example-with-helpers.hbs`, it will look for `example-with-helpers.json`. If it doesn't find one, it will create a sample data file.

## How it works

1. The extension starts a local server on port 4848
2. Your Handlebars template is rendered using data from the JSON file
3. When you make changes and save the file, the page automatically refreshes

## Troubleshooting

- **Page not refreshing?** Make sure to save files after making changes
- **No status bar button?** Make sure you're working with a .hbs or .handlebars file
- **Port in use?** If port 4848 is in use, close the application using it

## Example

To test the extension, use the included example files:

- `example-with-helpers.hbs`
- `example-with-helpers.json`

## License

MIT
