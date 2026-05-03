import * as vscode from 'vscode';
import { HighlightManager } from './_app/highlight-manager';

let controller: HighlightManager | undefined;

export function activate(context: vscode.ExtensionContext): void {
    controller = new HighlightManager();
    controller.register(context);
}

export function deactivate(): void {
    controller?.dispose();
    controller = undefined;
}
