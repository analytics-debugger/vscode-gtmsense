import * as vscode from 'vscode';
import { GtmFileSystemProvider } from './fileSystemProvider';

type TreeItemType = 'container' | 'workspace' | 'folder' | 'template' | 'file';

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
		public readonly workspaceName?: string,
		public readonly templateName?: string // For template section files
	) {
		super(label, collapsibleState);

		// Set contextValue - modified files get a special context for menu visibility
		if (itemType === 'file' && isModified) {
			this.contextValue = 'file-modified';
		} else if (itemType === 'folder' && folderName) {
			// Include folder name in context for menu filtering (e.g., "folder-tags", "folder-variables", "folder-templates")
			this.contextValue = `folder-${folderName}`;
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
				this.iconPath = new vscode.ThemeIcon(
					folderName === 'tags' ? 'tag' : folderName === 'variables' ? 'symbol-variable' : 'extensions'
				);
				break;
			case 'template':
				this.iconPath = new vscode.ThemeIcon('symbol-class');
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
			// Show tags, variables, and templates folders under workspace
			return [
				new GtmTreeItem('tags', 'folder', vscode.TreeItemCollapsibleState.Collapsed, element.containerName, 'tags'),
				new GtmTreeItem('variables', 'folder', vscode.TreeItemCollapsibleState.Collapsed, element.containerName, 'variables'),
				new GtmTreeItem('templates', 'folder', vscode.TreeItemCollapsibleState.Collapsed, element.containerName, 'templates')
			];
		}

		if (element.itemType === 'folder' && element.containerName && element.folderName) {
			// Show files in folder (or template directories for templates folder)
			const uri = vscode.Uri.from({ scheme: 'gtmsense', path: `/${element.containerName}/${element.folderName}` });
			try {
				const entries = this.fsProvider.readDirectory(uri);

				if (element.folderName === 'templates') {
					// Templates folder contains template directories
					return entries
						.filter(([, type]) => type === vscode.FileType.Directory)
						.map(([name]) => new GtmTreeItem(
							name,
							'template',
							vscode.TreeItemCollapsibleState.Collapsed,
							element.containerName,
							'templates',
							undefined,
							undefined,
							undefined,
							undefined,
							name // templateName
						));
				} else {
					// Tags/variables folders contain files
					return entries
						.filter(([, type]) => type === vscode.FileType.File)
						.map(([name]) => {
							const fileUri = vscode.Uri.from({ scheme: 'gtmsense', path: `/${element.containerName}/${element.folderName}/${name}` });
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
				}
			} catch (error) {
				console.error('Failed to read directory:', uri.toString(), error);
				return [];
			}
		}

		if (element.itemType === 'template' && element.containerName && element.templateName) {
			// Show section files inside a template
			const uri = vscode.Uri.from({ scheme: 'gtmsense', path: `/${element.containerName}/templates/${element.templateName}` });
			try {
				const entries = this.fsProvider.readDirectory(uri);
				return entries
					.filter(([, type]) => type === vscode.FileType.File)
					.map(([name]) => {
						const fileUri = vscode.Uri.from({ scheme: 'gtmsense', path: `/${element.containerName}/templates/${element.templateName}/${name}` });
						const isModified = this.fsProvider.isModified(fileUri);
						// Remove extension for display
						const displayName = name.replace(/\.(js|json|txt)$/, '');
						return new GtmTreeItem(
							displayName,
							'file',
							vscode.TreeItemCollapsibleState.None,
							element.containerName,
							'templates',
							fileUri,
							undefined,
							isModified,
							undefined,
							element.templateName
						);
					});
			} catch (error) {
				console.error('Failed to read template directory:', uri.toString(), error);
				return [];
			}
		}

		return [];
	}
}
