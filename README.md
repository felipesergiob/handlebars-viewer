# Handlebars Viewer

VS Code extension that previews Handlebars templates as a PDF beside the editor and re-renders on every save.

## Features

- Renders the open `.hbs` or `.handlebars` template to PDF with Puppeteer and shows it in a panel next to the editor.
- Reads data from a JSON file with the same name as the template (`invoice.hbs` uses `invoice.json`).
- When there is no data file, generates one from the variables used in the template, so the preview works right away.
- Re-renders when the template or its JSON data is saved.
- Missing helpers render as empty strings instead of breaking the preview.

## Usage

1. Open a `.hbs` or `.handlebars` file.
2. Click **Handlebars Viewer** in the status bar, or run **Preview Handlebars Template** or **Open Handlebars Preview in Side Panel** from the Command Palette.
3. Edit the template or the JSON file and save. The preview updates.

The repository includes `example-with-helpers.hbs` and `example-with-helpers.json` to try it.

## Install

From the packaged extension in this repository:

```bash
code --install-extension handlebars-viewer-0.0.1.vsix
```

From source:

```bash
yarn install
```

Then open the folder in VS Code and press F5 to start an Extension Development Host.

## How it works

| File | Responsibility |
|---|---|
| `src/extension.js` | Commands, status bar item, preview panel and file watchers |
| `src/handlebarsViewer.js` | Compiles the template with its JSON data |
| `src/templateAnalyzer.js` | Extracts variables from the template to build sample data |
| `src/pdfGenerator.js` | Renders the HTML to PDF with Puppeteer |

## License

MIT
