import * as vscode from "vscode";
import * as path from "path";

export class OpenSCADPreviewProvider {
    private static readonly viewType = "openscad-preview";
    private static currentPanel: vscode.WebviewPanel | undefined;
    private static currentUri: vscode.Uri | undefined;
    private disposables: vscode.Disposable[] = [];
    private fileWatcher: vscode.FileSystemWatcher | undefined;

    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        return vscode.Disposable.from();
    }

    public static createOrShow(
        context: vscode.ExtensionContext,
        uri: vscode.Uri,
    ) {
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
                    vscode.Uri.file(path.join(context.extensionPath, "dist", "wasm")),
                    vscode.Uri.file(path.join(context.extensionPath, "dist", "libs")),
                ],
            },
        );

        OpenSCADPreviewProvider.currentPanel = panel;
        OpenSCADPreviewProvider.currentUri = uri;

        // Create the provider instance
        const provider = new OpenSCADPreviewProvider(context, panel, uri);

        // Set initial content
        provider.initWebview();

        // Set up file watcher for auto-refresh
        provider.setupFileWatcher();

        // Handle panel disposal
        panel.onDidDispose(() => provider.dispose(), null, provider.disposables);
    }

    private static updateContent(
        context: vscode.ExtensionContext,
        uri: vscode.Uri,
    ) {
        if (OpenSCADPreviewProvider.currentPanel) {
            OpenSCADPreviewProvider.currentUri = uri;
            OpenSCADPreviewProvider.currentPanel.title = `OpenSCAD Preview: ${path.basename(uri.fsPath)}`;

            // Update the webview content
            const provider = new OpenSCADPreviewProvider(
                context,
                OpenSCADPreviewProvider.currentPanel,
                uri,
            );
            provider.updateWebviewContent();
        }
    }

    private constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly panel: vscode.WebviewPanel,
        private readonly uri: vscode.Uri,
    ) {
        // Set up message handling
        this.panel.webview.onDidReceiveMessage(
            (message) => {
                switch (message.type) {
                    case "ready":
                        this.updateWebviewContent();
                        break;
                    case "error":
                        vscode.window.showErrorMessage(
                            `OpenSCAD Preview Error: ${message.message}`,
                        );
                        break;
                    case "info":
                        vscode.window.showInformationMessage(message.message);
                        break;
                }
            },
            null,
            this.disposables,
        );
    }

    private setupFileWatcher() {
        const config = vscode.workspace.getConfiguration("openscad-preview");
        const autoRefresh = config.get("autoRefresh", true);

        if (autoRefresh) {
            // Watch for changes to .scad and .openscad files
            this.fileWatcher = vscode.workspace.createFileSystemWatcher(
                "**/*.{scad,openscad}",
            );

            this.fileWatcher.onDidChange((changedUri) => {
                if (changedUri.fsPath === this.uri.fsPath) {
                    console.log(`File changed: ${changedUri.fsPath}`);
                    this.updateWebviewContent();
                }
            });

            this.disposables.push(this.fileWatcher);
        }
    }

    private async initWebview() {
        try {
            // Read the file content
            const document = await vscode.workspace.openTextDocument(this.uri);
            const content = document.getText();

            // Generate the webview HTML (only once!)
            this.panel.webview.html = this.getHtmlForWebview(content);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to read file: ${error}`);
        }
    }

    private async updateWebviewContent() {
        try {
            // Read the file content
            const document = await vscode.workspace.openTextDocument(this.uri);
            const content = document.getText();

            // Send the content to the webview (without recreating HTML!)
            this.panel.webview.postMessage({
                type: "update",
                content: content,
                fileName: path.basename(this.uri.fsPath),
            });
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to read file: ${error}`);
        }
    }

    private getHtmlForWebview(scadContent: string): string {
        const webview = this.panel.webview;

        // Get paths to WASM files and libraries
        const wasmPath = vscode.Uri.file(
            path.join(this.context.extensionPath, "dist", "wasm"),
        );
        const wasmUri = webview.asWebviewUri(wasmPath);

        const libsPath = vscode.Uri.file(
            path.join(this.context.extensionPath, "dist", "libs"),
        );
        const libsUri = webview.asWebviewUri(libsPath);

        // Get nonce for security
        const nonce = getNonce();

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}' 'unsafe-eval' 'wasm-unsafe-eval' ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline'; connect-src data: blob: ${webview.cspSource};">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OpenSCAD Preview</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            margin: 0;
            padding: 0;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            height: 100vh;
            display: flex;
            flex-direction: column;
        }
        
        .header {
            padding: 15px 20px;
            border-bottom: 1px solid var(--vscode-panel-border);
            display: flex;
            justify-content: space-between;
            align-items: center;
            background-color: var(--vscode-sideBar-background);
        }
        
        .title {
            font-size: 16px;
            font-weight: 600;
            color: var(--vscode-titleBar-activeForeground);
        }
        
        .toolbar {
            display: flex;
            gap: 10px;
            align-items: center;
        }
        
        .btn {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 6px 12px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
        }
        
        .btn:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        
        .btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }
        
        .status {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }
        
        .content {
            flex: 1;
            display: flex;
            min-height: 0;
        }
        
        .preview-panel {
            flex: 1;
            display: flex;
            flex-direction: column;
            background-color: var(--vscode-editor-background);
        }
        
        .preview-header {
            padding: 10px 15px;
            border-bottom: 1px solid var(--vscode-panel-border);
            font-size: 12px;
            font-weight: 600;
            color: var(--vscode-titleBar-activeForeground);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .preview-area {
            flex: 1;
            position: relative;
            background: #1e1e1e;
        }
        
        model-viewer {
            width: 100%;
            height: 100%;
            background-color: #1e1e1e;
        }
        
        model-viewer:not([src]) {
            display: none;
        }
        
        .preview-placeholder {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            text-align: center;
            color: #888;
        }
        
        .loading {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            text-align: center;
            color: #ccc;
        }
        
        .error {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            text-align: center;
            color: #f48771;
            max-width: 80%;
        }
        
        /* No mobile layout changes needed for full-screen preview */
    </style>
</head>
<body>
    <div class="header">
        <div class="title">🔧 OpenSCAD Preview - ${path.basename(this.uri.fsPath)}</div>
        <div class="toolbar">
            <button id="renderBtn" class="btn">🔄 Render</button>
            <button id="exportBtn" class="btn" disabled>💾 Export OFF</button>
            <span id="status" class="status">Ready</span>
        </div>
    </div>
    
    <div class="content">
        <div class="preview-panel">
            <div class="preview-header">
                <span>👀 3D Preview</span>
                <span id="renderInfo" style="font-size: 11px; color: var(--vscode-descriptionForeground);">Click render to start</span>
            </div>
            <div class="preview-area">
                <model-viewer 
                    id="modelViewer"
                    camera-controls 
                    touch-action="pan-y"
                    interaction-prompt="none"
                    shadow-intensity="1"
                    environment-image="neutral"
                >
                </model-viewer>
                <div id="preview-placeholder" class="preview-placeholder">
                    <div>🎯 3D Preview</div>
                    <div style="font-size: 12px; margin-top: 10px;">Click render to generate your model</div>
                </div>
                <div id="loading" class="loading" style="display: none;">
                    <div>🔄 Rendering OpenSCAD model...</div>
                    <div style="font-size: 12px; margin-top: 10px;">This may take a few moments</div>
                </div>
                <div id="error" class="error" style="display: none;"></div>
            </div>
        </div>
    </div>

    <script nonce="${nonce}" src="${libsUri}/model-viewer.min.js"></script>
    <script nonce="${nonce}" src="${libsUri}/off-glb-converter.js"></script>
    <script type="module" nonce="${nonce}">
        
        // Track script executions to detect reloading
        if (!window.scriptExecutionCount) {
            window.scriptExecutionCount = 0;
        }
        window.scriptExecutionCount++;
        
        console.log('🚀 Script execution #' + window.scriptExecutionCount + ' - Model-viewer loaded successfully');
        console.log('OpenSCAD Preview webview with Model Viewer loaded!');
        
        if (window.scriptExecutionCount > 1) {
            console.warn('⚠️ Script has executed ' + window.scriptExecutionCount + ' times - webview may be reloading!');
        }
        
        // Debug logging
        window.addEventListener('error', (e) => {
            console.error('Global error:', e.error, e.message, e.filename, e.lineno);
            showError('Error: ' + e.message);
        });
        
        window.addEventListener('unhandledrejection', (e) => {
            console.error('Unhandled promise rejection:', e.reason);
            showError('Promise error: ' + e.reason);
        });
        
        // Global variables
        let openscadModule = null;
        let currentOFFData = null;
        let isRendering = false;
        
        // Get DOM elements
        const modelViewer = document.getElementById('modelViewer');
        const renderBtn = document.getElementById('renderBtn');
        const exportBtn = document.getElementById('exportBtn');
        const status = document.getElementById('status');
        const loading = document.getElementById('loading');
        const error = document.getElementById('error');
        const renderInfo = document.getElementById('renderInfo');
        const placeholder = document.getElementById('preview-placeholder');
        
        // Store current SCAD content
        let currentScadContent = \`${scadContent.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`;
        
        // VS Code API
        const vscode = acquireVsCodeApi();
        
        // Initialize model-viewer
        function initModelViewer() {
            try {
                console.log('Initializing Model Viewer...');
                
                // Wait for model-viewer to be ready
                modelViewer.addEventListener('load', () => {
                    console.log('Model loaded in viewer');
                    placeholder.style.display = 'none';
                });
                
                modelViewer.addEventListener('error', (e) => {
                    console.error('Model viewer error:', e);
                    showError('Model viewer error: ' + e.detail?.error || 'Unknown error');
                });
                
                console.log('Model Viewer initialization complete');
                renderInfo.textContent = 'Model Viewer ready - Click render to start';
            } catch (error) {
                console.error('Model Viewer initialization failed:', error);
                showError('Model Viewer initialization failed: ' + error.message);
            }
        }
        
        // Global flag to prevent multiple initialization attempts
        if (!window.openscadInitCount) {
            window.openscadInitCount = 0;
        }
        
        // Initialize OpenSCAD WASM
        async function initOpenSCAD() {
            window.openscadInitCount++;
            console.log('🔄 initOpenSCAD() called - attempt #' + window.openscadInitCount);
            console.log('📍 Call stack:', new Error().stack?.split('\\n')[1]?.trim());
            
            // CRITICAL: Hard stop after 3 attempts
            if (window.openscadInitCount > 3) {
                console.error('🛑 STOPPING: Too many initialization attempts! Something is wrong.');
                status.textContent = 'WASM initialization failed - too many retries';
                return;
            }
            
            // Prevent multiple simultaneous attempts
            if (window.wasmInitializing) {
                console.log('⚠️ WASM initialization already in progress, attempt #' + window.openscadInitCount + ' - SKIPPING');
                return;
            }
            
            if (openscadModule && openscadModule.calledRun) {
                console.log('✅ OpenSCAD WASM already initialized, attempt #' + window.openscadInitCount + ' - SKIPPING');
                status.textContent = 'OpenSCAD WASM ready';
                renderBtn.disabled = false;
                return;
            }
            
            window.wasmInitializing = true;
            
            try {
                status.textContent = 'Loading OpenSCAD WASM...';
                console.log('Starting OpenSCAD WASM initialization...');
                console.log('WASM URI:', '${wasmUri}');
                
                // Test if we can fetch the WASM file
                try {
                    const wasmResponse = await fetch('${wasmUri}/openscad.wasm');
                    console.log('WASM file fetch response:', wasmResponse.status, wasmResponse.statusText);
                    if (!wasmResponse.ok) {
                        throw new Error(\`Failed to fetch WASM file: \${wasmResponse.status} \${wasmResponse.statusText}\`);
                    }
                } catch (fetchError) {
                    console.error('WASM file fetch failed:', fetchError);
                    throw new Error('WASM file not accessible: ' + fetchError.message);
                }
                
                // Load OpenSCAD WASM using the direct Emscripten approach
                console.log('Loading OpenSCAD WASM.js module...');
                
                const wasmJsUrl = '${wasmUri}/openscad.wasm.js';
                const wasmUrl = '${wasmUri}/openscad.wasm';
                
                console.log('Loading from:', wasmJsUrl);
                console.log('WASM binary at:', wasmUrl);
                
                // Set up module initialization promise
                let moduleResolve, moduleReject;
                const modulePromise = new Promise((resolve, reject) => {
                    moduleResolve = resolve;
                    moduleReject = reject;
                });
                
                // Set up the global OpenSCAD object that the WASM.js expects
                window.OpenSCAD = {
                    noInitialRun: false,  // Let it initialize automatically
                    locateFile: (path) => {
                        console.log('locateFile called with path:', path);
                        if (path.endsWith('.wasm')) {
                            return wasmUrl;
                        }
                        const fullPath = '${wasmUri}/' + path;
                        console.log('Returning full path:', fullPath);
                        return fullPath;
                    },
                    onRuntimeInitialized: () => {
                        console.log('OpenSCAD WASM runtime initialized');
                        moduleResolve(window.Module);
                    },
                    print: (text) => {
                        console.log('OpenSCAD stdout:', text);
                    },
                    printErr: (text) => {
                        console.warn('OpenSCAD stderr:', text);
                    }
                };
                
                // Create a script tag to load the WASM module
                const script = document.createElement('script');
                script.src = wasmJsUrl;
                
                // Handle script loading
                script.onload = () => {
                    console.log('OpenSCAD WASM.js loaded successfully');
                    console.log('Script loaded, WASM should now initialize automatically...');
                };
                
                script.onerror = (error) => {
                    console.error('Failed to load OpenSCAD WASM.js:', error);
                    moduleReject(new Error('Failed to load OpenSCAD WASM.js'));
                };
                
                document.head.appendChild(script);
                
                // Wait for module initialization with timeout and fallback checking
                console.log('Waiting for module initialization...');
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => {
                        reject(new Error('WASM initialization timeout (10 seconds)'));
                    }, 10000);
                });
                
                // Fallback: periodically check if module is ready even if callback doesn't fire
                const pollPromise = new Promise((resolve) => {
                    const checkModule = () => {
                        if (window.Module && window.Module.calledRun && window.Module.FS) {
                            console.log('Module detected as ready via polling (callback may have failed)');
                            resolve(window.Module);
                        } else {
                            setTimeout(checkModule, 500);
                        }
                    };
                    setTimeout(checkModule, 2000); // Start checking after 2 seconds
                });
                
                openscadModule = await Promise.race([modulePromise, timeoutPromise, pollPromise]);
                console.log('OpenSCAD module initialization complete');
                
                status.textContent = 'OpenSCAD WASM ready';
                renderBtn.disabled = false;
                console.log('OpenSCAD WASM module initialized successfully');
            } catch (err) {
                console.error('Failed to initialize OpenSCAD WASM:', err);
                console.error('Error stack:', err.stack);
                status.textContent = 'WASM loading failed';
                showError('Failed to load OpenSCAD WASM: ' + err.message);
                renderBtn.disabled = true;
            } finally {
                window.wasmInitializing = false;
            }
        }
        
        // Render OpenSCAD model
        async function renderModel() {
            if (!openscadModule || isRendering) return;
            
            const scadCode = currentScadContent;
            if (!scadCode.trim()) {
                showError('No OpenSCAD code to render');
                return;
            }
            
            isRendering = true;
            renderBtn.disabled = true;
            exportBtn.disabled = true;
            hideError();
            showLoading();
            status.textContent = 'Rendering...';
            
            try {
                const startTime = Date.now();
                
                // Write SCAD file to WASM filesystem
                console.log('Writing SCAD code to filesystem...');
                openscadModule.FS.writeFile('/input.scad', scadCode);
                
                // Run OpenSCAD to generate OFF
                const args = ['/input.scad', '--enable=manifold', '-o', '/output.off'];
                console.log('Running OpenSCAD with args:', args);
                
                try {
                    openscadModule.callMain(args);
                    console.log('OpenSCAD callMain completed');
                } catch (callError) {
                    console.log('OpenSCAD callMain finished with exit code (this is normal):', callError);
                    // OpenSCAD might exit with non-zero code even on success
                }
                
                // Check if output file exists
                try {
                    const fileExists = openscadModule.FS.analyzePath('/output.off').exists;
                    console.log('Output file exists:', fileExists);
                    if (!fileExists) {
                        throw new Error('OpenSCAD did not generate output file - compilation may have failed');
                    }
                } catch (pathError) {
                    console.error('Error checking output file:', pathError);
                    throw new Error('Failed to verify output file existence');
                }
                
                // Read the generated OFF
                console.log('Reading generated OFF file...');
                const offData = openscadModule.FS.readFile('/output.off', { encoding: 'utf8' });
                console.log('OFF file read successfully, size:', offData.length, 'chars');
                currentOFFData = offData;
                
                const renderTime = Date.now() - startTime;
                console.log(\`Rendering completed in \${renderTime}ms\`);
                
                // Load OFF into model-viewer
                await loadOFFIntoViewer(offData);
                
                status.textContent = 'Render complete';
                renderInfo.textContent = \`Rendered in \${renderTime}ms\`;
                exportBtn.disabled = false;
                
            } catch (err) {
                console.error('Render error:', err);
                showError('Rendering failed: ' + err.message);
                status.textContent = 'Render failed';
            } finally {
                isRendering = false;
                renderBtn.disabled = false;
                hideLoading();
            }
        }
        
        // Convert OFF to GLB and load into model-viewer using gltf-transform
        async function loadOFFIntoViewer(offData) {
            try {
                console.log('Converting OFF to GLB for model-viewer...');
                
                // Parse OFF data
                const polyhedron = parseOff(offData);
                console.log('OFF parsed successfully, vertices:', polyhedron.vertices.length, 'faces:', polyhedron.faces.length);
                
                // Export to GLB
                const glbBlob = await exportGlb(polyhedron);
                console.log('OFF converted to GLB successfully, size:', glbBlob.size, 'bytes');
                
                // Create blob URL for the GLB data
                const url = URL.createObjectURL(glbBlob);
                console.log('Created GLB blob URL:', url);
                
                // Set the model source
                modelViewer.src = url;
                
                // Show the model-viewer, hide placeholder
                modelViewer.style.display = 'block';
                placeholder.style.display = 'none';
                
                console.log('GLB loaded into model-viewer');
                
            } catch (error) {
                console.error('Error converting OFF to GLB:', error);
                showError('Failed to convert OFF: ' + error.message);
            }
        }
        
        // Export OFF file
        function exportOFF() {
            if (!currentOFFData) return;
            
            const blob = new Blob([currentOFFData], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = '${path.basename(this.uri.fsPath, path.extname(this.uri.fsPath))}.off';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            status.textContent = 'OFF exported';
        }
        
        // UI Helper functions
        function showLoading() {
            loading.style.display = 'block';
            error.style.display = 'none';
        }
        
        function hideLoading() {
            loading.style.display = 'none';
        }
        
        function showError(message) {
            error.textContent = message;
            error.style.display = 'block';
            loading.style.display = 'none';
        }
        
        function hideError() {
            error.style.display = 'none';
        }
        
        // Event listeners
        renderBtn.addEventListener('click', renderModel);
        exportBtn.addEventListener('click', exportOFF);
        
        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.type) {
                case 'update':
                    console.log('Received content update');
                    currentScadContent = message.content;
                    break;
            }
        });
        
        // Initialize everything
        initModelViewer();
        initOpenSCAD();
        
        // Send ready message to extension
        vscode.postMessage({ type: 'ready' });
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
    let text = "";
    const possible =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
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
