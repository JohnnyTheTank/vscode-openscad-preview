import * as vscode from 'vscode';
import * as path from 'path';

export class OpenSCADPreviewProvider {
    private static readonly viewType = 'openscad-preview';
    private static currentPanel: vscode.WebviewPanel | undefined;
    private static currentUri: vscode.Uri | undefined;
    private disposables: vscode.Disposable[] = [];
    private fileWatcher: vscode.FileSystemWatcher | undefined;

    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        return vscode.Disposable.from();
    }

    public static createOrShow(context: vscode.ExtensionContext, uri: vscode.Uri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If we already have a panel, show it
        if (OpenSCADPreviewProvider.currentPanel) {
            OpenSCADPreviewProvider.currentPanel.reveal(column);
            OpenSCADPreviewProvider.currentUri = uri;
            OpenSCADPreviewProvider.updateContent(context, uri);
            return;
        }

        // Otherwise, create a new panel
        const panel = vscode.window.createWebviewPanel(
            OpenSCADPreviewProvider.viewType,
            `OpenSCAD Preview: ${path.basename(uri.fsPath)}`,
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.file(path.join(context.extensionPath, 'src', 'webview'))
                ]
            }
        );

        OpenSCADPreviewProvider.currentPanel = panel;
        OpenSCADPreviewProvider.currentUri = uri;

        // Create the provider instance
        const provider = new OpenSCADPreviewProvider(context, panel, uri);

        // Set initial content
        provider.updateWebview();

        // Set up file watcher for auto-refresh
        provider.setupFileWatcher();

        // Handle panel disposal
        panel.onDidDispose(() => provider.dispose(), null, provider.disposables);
    }

    private static updateContent(context: vscode.ExtensionContext, uri: vscode.Uri) {
        if (OpenSCADPreviewProvider.currentPanel) {
            OpenSCADPreviewProvider.currentUri = uri;
            OpenSCADPreviewProvider.currentPanel.title = `OpenSCAD Preview: ${path.basename(uri.fsPath)}`;

            // Update the webview content
            const provider = new OpenSCADPreviewProvider(
                context,
                OpenSCADPreviewProvider.currentPanel,
                uri
            );
            provider.updateWebview();
        }
    }

    private constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly panel: vscode.WebviewPanel,
        private readonly uri: vscode.Uri
    ) {
        // Set up message handling
        this.panel.webview.onDidReceiveMessage(
            message => {
                switch (message.type) {
                    case 'ready':
                        this.updateWebview();
                        break;
                    case 'error':
                        vscode.window.showErrorMessage(`OpenSCAD Preview Error: ${message.message}`);
                        break;
                    case 'info':
                        vscode.window.showInformationMessage(message.message);
                        break;
                }
            },
            null,
            this.disposables
        );
    }

    private setupFileWatcher() {
        const config = vscode.workspace.getConfiguration('openscad-preview');
        const autoRefresh = config.get('autoRefresh', true);

        if (autoRefresh) {
            // Watch for changes to .scad and .openscad files
            this.fileWatcher = vscode.workspace.createFileSystemWatcher('**/*.{scad,openscad}');

            this.fileWatcher.onDidChange((changedUri) => {
                if (changedUri.fsPath === this.uri.fsPath) {
                    console.log(`File changed: ${changedUri.fsPath}`);
                    this.updateWebview();
                }
            });

            this.disposables.push(this.fileWatcher);
        }
    }

    private async updateWebview() {
        try {
            // Read the file content
            const document = await vscode.workspace.openTextDocument(this.uri);
            const content = document.getText();

            // Generate the webview HTML
            this.panel.webview.html = this.getHtmlForWebview(content);

            // Send the content to the webview
            this.panel.webview.postMessage({
                type: 'update',
                content: content,
                fileName: path.basename(this.uri.fsPath)
            });
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to read file: ${error}`);
        }
    }

    private getHtmlForWebview(scadContent: string): string {
        const webview = this.panel.webview;

        // Get nonce for security
        const nonce = getNonce();

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}' 'unsafe-inline'; style-src ${webview.cspSource} 'unsafe-inline';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OpenSCAD Preview</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            margin: 0;
            padding: 20px;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        
        .header {
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 20px;
            margin-bottom: 20px;
        }
        
        .title {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 10px;
            color: var(--vscode-titleBar-activeForeground);
        }
        
        .subtitle {
            color: var(--vscode-descriptionForeground);
            font-size: 14px;
        }
        
        .content {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
        }
        
        .panel {
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            padding: 20px;
        }
        
        .panel-title {
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 15px;
            color: var(--vscode-titleBar-activeForeground);
        }
        
        .code-content {
            background-color: var(--vscode-textCodeBlock-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            padding: 15px;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 13px;
            line-height: 1.4;
            white-space: pre-wrap;
            overflow-x: auto;
            max-height: 400px;
            overflow-y: auto;
        }
        
        .preview-area {
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 300px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 8px;
            color: white;
            text-align: center;
            font-size: 18px;
        }
        
        .status {
            margin-top: 10px;
            padding: 10px;
            background-color: var(--vscode-inputValidation-infoBackground);
            border: 1px solid var(--vscode-inputValidation-infoBorder);
            border-radius: 4px;
            font-size: 12px;
        }
        
        @media (max-width: 768px) {
            .content {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="title">🔧 OpenSCAD Preview</div>
            <div class="subtitle">Simple React-based preview for ${path.basename(this.uri.fsPath)}</div>
        </div>
        
        <div class="content">
            <div class="panel">
                <div class="panel-title">📝 Source Code</div>
                <div id="code-content" class="code-content">${escapeHtml(scadContent)}</div>
                <div class="status">
                    Auto-refresh: <strong>Enabled</strong> | Lines: <strong>${scadContent.split('\n').length}</strong>
                </div>
            </div>
            
            <div class="panel">
                <div class="panel-title">👀 Preview</div>
                <div class="preview-area">
                    <div>
                        <h2>🎉 Hello World from React!</h2>
                        <p>OpenSCAD Preview Extension is working!</p>
                        <p>File: <strong>${path.basename(this.uri.fsPath)}</strong></p>
                        <p style="font-size: 14px; opacity: 0.8;">Ready for 3D rendering integration</p>
                    </div>
                </div>
                <div class="status">
                    Status: <strong>Ready</strong> | Preview: <strong>Active</strong>
                </div>
            </div>
        </div>
    </div>

    <script nonce="${nonce}">
        console.log('OpenSCAD Preview webview loaded!');
        
        // Send ready message to extension
        const vscode = acquireVsCodeApi();
        vscode.postMessage({ type: 'ready' });
        
        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.type) {
                case 'update':
                    console.log('Received content update');
                    const codeContent = document.getElementById('code-content');
                    if (codeContent) {
                        codeContent.textContent = message.content;
                    }
                    break;
            }
        });
        
        // Simple React-like behavior simulation (without actual React for simplicity)
        function updatePreview() {
            console.log('Preview updated!');
        }
        
        // Auto-refresh indicator
        setInterval(() => {
            const now = new Date().toLocaleTimeString();
            console.log(\`Preview heartbeat: \${now}\`);
        }, 10000);
    </script>
</body>
</html>`;
    }

    public dispose() {
        OpenSCADPreviewProvider.currentPanel = undefined;
        OpenSCADPreviewProvider.currentUri = undefined;

        // Clean up resources
        this.panel.dispose();

        if (this.fileWatcher) {
            this.fileWatcher.dispose();
        }

        while (this.disposables.length) {
            const disposable = this.disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

function escapeHtml(unsafe: string): string {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}