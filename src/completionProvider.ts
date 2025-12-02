import * as vscode from 'vscode';
import { GtmFileSystemProvider } from './fileSystemProvider';

export class GtmCompletionProvider implements vscode.CompletionItemProvider {
	constructor(private fsProvider: GtmFileSystemProvider) {}

	provideCompletionItems(
		document: vscode.TextDocument,
		position: vscode.Position
	): vscode.CompletionItem[] | undefined {
		// Only provide completions for gtmsense:// files
		if (document.uri.scheme !== 'gtmsense') {
			return undefined;
		}

		// Check if we're typing after {{
		const linePrefix = document.lineAt(position).text.substring(0, position.character);
		if (!linePrefix.endsWith('{{') && !linePrefix.match(/\{\{[^}]*$/)) {
			return undefined;
		}

		// Get variable names for this container, or all if we can't determine
		const containerName = this.fsProvider.getContainerFromUri(document.uri);
		const variableNames = containerName
			? this.fsProvider.getVariableNames(containerName)
			: this.fsProvider.getAllVariableNames();

		// Check if there's already }} after the cursor
		const lineAfter = document.lineAt(position).text.substring(position.character);
		const hasClosingBraces = lineAfter.startsWith('}}');

		return variableNames.map(name => {
			const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Variable);
			item.detail = 'GTM Variable';

			// Only add }} if not already present
			item.insertText = hasClosingBraces ? name : name + '}}';

			return item;
		});
	}
}
