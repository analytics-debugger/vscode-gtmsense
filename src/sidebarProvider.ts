import * as vscode from 'vscode';
import { GtmFileSystemProvider } from './fileSystemProvider';

type TreeItemType = 'container' | 'workspace' | 'folder' | 'file';

export class GtmTreeItem extends vscode.TreeItem {
	constructor(
		public readonly label: string,
		public readonly itemType: TreeItemType,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState,
		public readonly containerName?: string,
		public readonly folderName?: string,
		public readonly uri?: vscode.Uri,
		public readonly publicId?: string,
		public readonly isModified?: boolean,
		public readonly workspaceName?: string
	) {
		super(label, collapsibleState);

		// Set contextValue - modified files get a special context for menu visibility
		if (itemType === 'file' && isModified) {
			this.contextValue = 'file-modified';
		} else {
			this.contextValue = itemType;
		}

		switch (itemType) {
			case 'container':
				this.iconPath = new vscode.ThemeIcon('package');
				this.description = publicId;
				break;
			case 'workspace':
				this.iconPath = new vscode.ThemeIcon('git-branch');
				break;
			case 'folder':
				this.iconPath = new vscode.ThemeIcon(folderName === 'tags' ? 'tag' : 'symbol-variable');
				break;
			case 'file':
				this.iconPath = new vscode.ThemeIcon('file-code');
				this.resourceUri = uri;
				if (uri) {
					this.command = {
						command: 'vscode.open',
						title: 'Open File',
						arguments: [uri]
					};
				}
				break;
		}
	}
}

export class GtmSidebarProvider implements vscode.TreeDataProvider<GtmTreeItem> {
	private _onDidChangeTreeData = new vscode.EventEmitter<GtmTreeItem | undefined>();
	readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

	constructor(private fsProvider: GtmFileSystemProvider) {}

	refresh(): void {
		this._onDidChangeTreeData.fire(undefined);
	}

	getTreeItem(element: GtmTreeItem): vscode.TreeItem {
		return element;
	}

	getChildren(element?: GtmTreeItem): GtmTreeItem[] {
		if (!element) {
			// Root level - show unique containers (grouped by name)
			const containers = this.fsProvider.getContainers();
			const uniqueContainers = new Map<string, { name: string; publicId: string }>();
			for (const c of containers) {
				if (!uniqueContainers.has(c.name)) {
					uniqueContainers.set(c.name, { name: c.name, publicId: c.publicId });
				}
			}
			return Array.from(uniqueContainers.values()).map(c => new GtmTreeItem(
				c.name,
				'container',
				vscode.TreeItemCollapsibleState.Expanded,
				c.name, // Use container name for grouping
				undefined,
				undefined,
				c.publicId
			));
		}

		if (element.itemType === 'container') {
			// Show all workspaces for this container
			const containers = this.fsProvider.getContainers();
			const workspaces = containers.filter(c => c.name === element.containerName);
			return workspaces.map(c => new GtmTreeItem(
				c.workspaceName,
				'workspace',
				vscode.TreeItemCollapsibleState.Expanded,
				c.key, // Use key for file system paths
				undefined,
				undefined,
				undefined,
				undefined,
				c.workspaceName
			));
		}

		if (element.itemType === 'workspace') {
			// Show tags and variables folders under workspace
			return [
				new GtmTreeItem('tags', 'folder', vscode.TreeItemCollapsibleState.Collapsed, element.containerName, 'tags'),
				new GtmTreeItem('variables', 'folder', vscode.TreeItemCollapsibleState.Collapsed, element.containerName, 'variables')
			];
		}

		if (element.itemType === 'folder' && element.containerName && element.folderName) {
			// Show files in folder
			const uri = vscode.Uri.parse(`gtmsense:/${element.containerName}/${element.folderName}`);
			try {
				const entries = this.fsProvider.readDirectory(uri);
				return entries
					.filter(([, type]) => type === vscode.FileType.File)
					.map(([name]) => {
						const fileUri = vscode.Uri.parse(`gtmsense:/${element.containerName}/${element.folderName}/${name}`);
						const isModified = this.fsProvider.isModified(fileUri);
						return new GtmTreeItem(
							name.replace(/\.js$/, ''), // Remove .js extension for display
							'file',
							vscode.TreeItemCollapsibleState.None,
							element.containerName,
							element.folderName,
							fileUri,
							undefined,
							isModified
						);
					});
			} catch {
				return [];
			}
		}

		return [];
	}
}
