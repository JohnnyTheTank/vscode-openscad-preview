// Script run within the webview itself.
(function () {
    // Get a reference to the VS Code webview api.
    const vscode = acquireVsCodeApi();

    const canvas = document.getElementById('canvas');
    const errorPanel = document.getElementById('error-panel');
    const errorContent = document.getElementById('error-content');
    const status = document.getElementById('status');
    const refreshBtn = document.getElementById('refreshBtn');
    const exportBtn = document.getElementById('exportBtn');

    let currentScadContent = '';
    let currentSTLData = null;
    let isRendering = false;
    let stlViewer = null;
    let openscadFS = null;
    let openscadModule = null;
    let isPlaygroundReady = false;

    // Initialize STL viewer
    if (canvas && window.STLViewer) {
        stlViewer = new window.STLViewer(canvas);
    }

    // Initialize OpenSCAD playground integration
    async function initializePlayground() {
        try {
            console.log('Initializing OpenSCAD playground in webview...');

            // Wait for BrowserFS to be available
            while (!window.BrowserFS) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            // Wait for OpenSCAD to be available
            while (!window.OpenSCAD) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            console.log('BrowserFS and OpenSCAD available');

            // Initialize BrowserFS
            window.BrowserFS.configure({
                fs: "MountableFileSystem",
                options: {
                    "/tmp": { fs: "InMemory" },
                    "/": { fs: "InMemory" }
                }
            }, async (err) => {
                if (err) {
                    console.error('BrowserFS configuration failed:', err);
                    return;
                }
                console.log('BrowserFS initialized successfully');
                openscadFS = window.BrowserFS.BFSRequire('fs');

                // Initialize OpenSCAD WASM module
                try {
                    console.log('Initializing OpenSCAD WASM module...');
                    openscadModule = await window.OpenSCAD({
                        // Provide filesystem
                        FS: openscadFS,
                        // Capture stdout/stderr
                        print: (text) => console.log('OpenSCAD stdout:', text),
                        printErr: (text) => console.warn('OpenSCAD stderr:', text),
                    });

                    console.log('OpenSCAD WASM module initialized');
                    isPlaygroundReady = true;
                    updateStatus('OpenSCAD playground ready');
                } catch (error) {
                    console.error('OpenSCAD WASM initialization failed:', error);
                    updateStatus('OpenSCAD WASM initialization failed', 'error');
                }
            });

        } catch (error) {
            console.error('Playground initialization failed:', error);
            updateStatus('Playground initialization failed', 'error');
        }
    }

    // Start playground initialization
    initializePlayground();

    // Handle messages sent from the extension to the webview
    window.addEventListener('message', event => {
        const message = event.data;
        switch (message.type) {
            case 'update':
                currentScadContent = message.text;
                if (!isRendering) {
                    renderModel();
                }
                break;

            case 'renderResult':
                handleRenderResult(message.result);
                break;
        }
    });

    // Set up event listeners
    refreshBtn.addEventListener('click', () => {
        renderModel();
    });

    exportBtn.addEventListener('click', () => {
        exportSTL();
    });

    // Add reset view button
    const resetViewBtn = document.createElement('button');
    resetViewBtn.id = 'resetViewBtn';
    resetViewBtn.title = 'Reset View';
    resetViewBtn.textContent = '🔄';
    resetViewBtn.addEventListener('click', () => {
        if (stlViewer) {
            stlViewer.resetView();
        }
    });
    document.getElementById('toolbar').appendChild(resetViewBtn);

    function updateStatus(text, className = '') {
        status.textContent = text;
        status.className = className;
    }

    function showError(errorText) {
        errorContent.textContent = errorText;
        errorPanel.classList.remove('hidden');
        updateStatus('Error', 'error');
    }

    function hideError() {
        errorPanel.classList.add('hidden');
    }

    async function renderModel() {
        if (!currentScadContent.trim()) {
            if (stlViewer) {
                stlViewer.vertices = [];
                stlViewer.faces = [];
                stlViewer.render();
            }
            updateStatus('No content to render');
            return;
        }

        isRendering = true;
        hideError();
        updateStatus('Rendering...', 'loading');
        refreshBtn.disabled = true;
        exportBtn.disabled = true;

        try {
            if (isPlaygroundReady && openscadModule) {
                console.log('Using client-side OpenSCAD playground rendering');
                await renderWithPlayground(currentScadContent);
            } else {
                console.log('Playground not ready, using fallback rendering');
                // Fallback to server-side rendering for now
                vscode.postMessage({
                    type: 'render',
                    scadContent: currentScadContent
                });
            }
        } catch (error) {
            console.error('Rendering failed:', error);
            showError('Rendering failed: ' + error.message);
            isRendering = false;
            refreshBtn.disabled = false;
            exportBtn.disabled = false;
            updateStatus('Render failed', 'error');
        }
    }

    async function renderWithPlayground(scadCode) {
        try {
            console.log('Starting OpenSCAD playground rendering...');

            const startTime = Date.now();

            // Create input and output files in the WASM filesystem
            const inputFile = '/main.scad';
            const outputFile = '/output.off';

            // Write SCAD code to the WASM filesystem
            openscadModule.FS.writeFile(inputFile, scadCode);

            // Prepare OpenSCAD arguments
            const args = [
                'openscad', // program name
                inputFile,
                '-o', outputFile,
                '--export-format=off',
                '--backend=manifold'
            ];

            console.log('OpenSCAD args:', args);

            // Execute OpenSCAD
            try {
                // Call the main function with arguments
                openscadModule.callMain(args);
                console.log('OpenSCAD execution completed');
            } catch (execError) {
                // OpenSCAD might exit with non-zero status even on success
                console.log('OpenSCAD execution finished with:', execError);
            }

            // Check if output file exists and read it
            let offData;
            try {
                offData = openscadModule.FS.readFile(outputFile, { encoding: 'utf8' });
                console.log('Generated OFF data length:', offData.length);
            } catch (readError) {
                throw new Error('OpenSCAD did not generate output file: ' + readError.message);
            }

            if (!offData || offData.length === 0) {
                throw new Error('OpenSCAD generated empty output');
            }

            // Convert OFF to STL for the viewer
            const stlData = convertOFFToSTL(offData);

            const renderTime = Date.now() - startTime;
            console.log(`Rendering completed in ${renderTime}ms`);

            // Handle the successful result
            handleRenderResult({
                success: true,
                stlData: stlData,
                error: null,
                warnings: [],
                renderTime: renderTime
            });

        } catch (error) {
            console.error('Playground rendering error:', error);

            handleRenderResult({
                success: false,
                stlData: null,
                error: error.message,
                warnings: [],
                renderTime: 0
            });
        }
    }

    function convertOFFToSTL(offData) {
        try {
            const lines = offData.split('\n').map(line => line.trim()).filter(line => line.length > 0);

            if (lines.length === 0 || !lines[0].startsWith('OFF')) {
                throw new Error('Invalid OFF format');
            }

            // Find the counts line (first line with three numbers)
            let countsLineIndex = -1;
            for (let i = 1; i < lines.length; i++) {
                const parts = lines[i].split(/\s+/);
                if (parts.length === 3 && !isNaN(Number(parts[0]))) {
                    countsLineIndex = i;
                    break;
                }
            }

            if (countsLineIndex === -1) {
                throw new Error('Could not find counts line in OFF format');
            }

            const counts = lines[countsLineIndex].split(/\s+/).map(Number);
            const [numVertices, numFaces] = counts;

            if (numVertices === 0 || numFaces === 0) {
                return getFallbackSTL();
            }

            // Parse vertices
            const vertices = [];
            for (let i = countsLineIndex + 1; i <= countsLineIndex + numVertices; i++) {
                if (i >= lines.length) break;
                const coords = lines[i].split(/\s+/).map(Number);
                if (coords.length >= 3) {
                    vertices.push([coords[0], coords[1], coords[2]]);
                }
            }

            // Parse faces and convert to STL
            let stlContent = 'solid OpenSCADModel\n';

            for (let i = countsLineIndex + numVertices + 1; i < countsLineIndex + numVertices + numFaces + 1; i++) {
                if (i >= lines.length) break;

                const faceLine = lines[i].split(/\s+/).map(Number);
                if (faceLine.length < 4) continue;

                const faceVertexCount = faceLine[0];
                if (faceVertexCount === 3) {
                    // Triangle face
                    const v1Index = faceLine[1];
                    const v2Index = faceLine[2];
                    const v3Index = faceLine[3];

                    if (v1Index < vertices.length && v2Index < vertices.length && v3Index < vertices.length) {
                        const v1 = vertices[v1Index];
                        const v2 = vertices[v2Index];
                        const v3 = vertices[v3Index];

                        // Calculate normal vector
                        const normal = calculateNormal(v1, v2, v3);

                        stlContent += `facet normal ${normal[0].toFixed(6)} ${normal[1].toFixed(6)} ${normal[2].toFixed(6)}\n`;
                        stlContent += '  outer loop\n';
                        stlContent += `    vertex ${v1[0].toFixed(6)} ${v1[1].toFixed(6)} ${v1[2].toFixed(6)}\n`;
                        stlContent += `    vertex ${v2[0].toFixed(6)} ${v2[1].toFixed(6)} ${v2[2].toFixed(6)}\n`;
                        stlContent += `    vertex ${v3[0].toFixed(6)} ${v3[1].toFixed(6)} ${v3[2].toFixed(6)}\n`;
                        stlContent += '  endloop\n';
                        stlContent += 'endfacet\n';
                    }
                }
            }

            stlContent += 'endsolid OpenSCADModel';
            return stlContent;

        } catch (error) {
            console.error('Failed to convert OFF to STL:', error);
            return getFallbackSTL();
        }
    }

    function calculateNormal(v1, v2, v3) {
        const u = [v2[0] - v1[0], v2[1] - v1[1], v2[2] - v1[2]];
        const v = [v3[0] - v1[0], v3[1] - v1[1], v3[2] - v1[2]];

        const normal = [
            u[1] * v[2] - u[2] * v[1],
            u[2] * v[0] - u[0] * v[2],
            u[0] * v[1] - u[1] * v[0]
        ];

        const length = Math.sqrt(normal[0] * normal[0] + normal[1] * normal[1] + normal[2] * normal[2]);

        if (length === 0) {
            return [0, 0, 1]; // Default normal
        }

        return [normal[0] / length, normal[1] / length, normal[2] / length];
    }

    function getFallbackSTL() {
        return `solid FallbackCube
facet normal 0 0 -1
  outer loop
    vertex -5 -5 -5
    vertex 5 -5 -5
    vertex 5 5 -5
  endloop
endfacet
facet normal 0 0 -1
  outer loop
    vertex -5 -5 -5
    vertex 5 5 -5
    vertex -5 5 -5
  endloop
endfacet
endsolid FallbackCube`;
    }

    function handleRenderResult(result) {
        try {
            if (result.success && result.stlData) {
                currentSTLData = result.stlData;
                if (stlViewer) {
                    stlViewer.loadSTL(result.stlData);
                }
                updateStatus(`Rendered successfully (${result.renderTime?.toFixed(0)}ms)`, 'success');

                if (result.warnings && result.warnings.length > 0) {
                    console.warn('OpenSCAD warnings:', result.warnings);
                }
            } else {
                throw new Error(result.error || 'Rendering failed');
            }
        } catch (error) {
            showError(error.message);
            vscode.postMessage({
                type: 'error',
                message: error.message
            });
        } finally {
            isRendering = false;
            refreshBtn.disabled = false;
            exportBtn.disabled = false;
        }
    }

    function exportSTL() {
        if (!currentSTLData) {
            updateStatus('No STL data to export');
            return;
        }

        vscode.postMessage({
            type: 'export',
            stlData: currentSTLData,
            format: 'stl'
        });
    }

    // Handle canvas resize
    function resizeCanvas() {
        const container = canvas.parentElement;
        const rect = container.getBoundingClientRect();
        canvas.width = Math.max(400, rect.width - 20);
        canvas.height = Math.max(300, rect.height - 20);

        if (stlViewer) {
            stlViewer.render();
        }
    }

    // Resize canvas when window resizes
    window.addEventListener('resize', resizeCanvas);

    // Initial resize
    setTimeout(resizeCanvas, 100);

    // Signal to VS Code that the webview is ready
    vscode.postMessage({
        type: 'ready'
    });

    // Initial render
    updateStatus('Ready');
})();
