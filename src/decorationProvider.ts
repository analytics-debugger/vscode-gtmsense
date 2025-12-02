import * as vscode from 'vscode';
import { GtmFileSystemProvider } from './fileSystemProvider';

export class GtmDecorationProvider implements vscode.FileDecorationProvider {
	private _onDidChangeFileDecorations = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();
	readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;

	constructor(private fsProvider: GtmFileSystemProvider) {
		// Listen for modification changes and update decorations
		fsProvider.onDidChangeModified(() => {
			this._onDidChangeFileDecorations.fire(undefined);
		});
	}

	provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
		if (uri.scheme !== 'gtmsense') {
			return undefined;
		}

		if (this.fsProvider.isModified(uri)) {
			return {
				badge: 'M',
				color: new vscode.ThemeColor('gitDecoration.modifiedResourceForeground'),
				tooltip: 'Modified - pending push to GTM'
			};
		}

		return undefined;
	}
}
