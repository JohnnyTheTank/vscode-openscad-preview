import * as vscode from 'vscode';
import { OpenSCADPreviewProvider } from './previewProvider';

export function activate(context: vscode.ExtensionContext) {
	console.log('OpenSCAD Preview extension is now active!');

	// Register our custom editor provider
	context.subscriptions.push(
		OpenSCADPreviewProvider.register(context)
	);

	// Register the show preview command
	context.subscriptions.push(
		vscode.commands.registerCommand('openscad-preview.showPreview', (uri?: vscode.Uri) => {
			// Get the current active file if no URI is provided
			if (!uri && vscode.window.activeTextEditor) {
				uri = vscode.window.activeTextEditor.document.uri;
			}

			if (!uri) {
				vscode.window.showErrorMessage('No OpenSCAD file to preview');
				return;
			}

			// Check if it's a .scad or .openscad file
			const isScadFile = uri.fsPath.endsWith('.scad') || uri.fsPath.endsWith('.openscad');
			if (!isScadFile) {
				vscode.window.showErrorMessage('Please select an OpenSCAD (.scad or .openscad) file');
				return;
			}

			// Create and show the preview panel
			OpenSCADPreviewProvider.createOrShow(context, uri);
		})
	);
}

export function deactivate() { }