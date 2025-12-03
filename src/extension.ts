import * as vscode from 'vscode';
import { GtmFileSystemProvider } from './fileSystemProvider';
import { GtmSidebarProvider } from './sidebarProvider';
import { GtmCompletionProvider } from './completionProvider';
import { GtmDiagnosticsProvider } from './diagnosticsProvider';
import { GtmDecorationProvider } from './decorationProvider';
import { GtmAccountProvider } from './accountProvider';
import { GoogleAuthenticationProvider } from './auth';
import { listAccounts, listContainers, listWorkspaces, createWorkspace, createTag, createVariable } from './gtmClient';

let fsProvider: GtmFileSystemProvider;
let sidebarProvider: GtmSidebarProvider;
let diagnosticsProvider: GtmDiagnosticsProvider;

export async function activate(context: vscode.ExtensionContext) {
	console.log('GTMSense is now active!');

	// Close any previously opened gtmsense:// files since they won't work after restart
	const gtmTabs = vscode.window.tabGroups.all
		.flatMap(group => group.tabs)
		.filter(tab => {
			const input = tab.input;
			if (input && typeof input === 'object' && 'uri' in input) {
				const uri = input.uri as vscode.Uri;
				return uri.scheme === 'gtmsense';
			}
			return false;
		});

	for (const tab of gtmTabs) {
		try {
			await vscode.window.tabGroups.close(tab);
		} catch {
			// Tab may already be closed or invalid, ignore
		}
	}

	fsProvider = new GtmFileSystemProvider();
	sidebarProvider = new GtmSidebarProvider(fsProvider);
	diagnosticsProvider = new GtmDiagnosticsProvider();
	const decorationProvider = new GtmDecorationProvider(fsProvider);

	// Register Google authentication provider
	const authProvider = new GoogleAuthenticationProvider(context);
	context.subscriptions.push(authProvider);

	// Register file system provider
	context.subscriptions.push(
		vscode.workspace.registerFileSystemProvider('gtmsense', fsProvider, {
			isCaseSensitive: true,
		})
	);

	// Register file decoration provider for modified files
	context.subscriptions.push(
		vscode.window.registerFileDecorationProvider(decorationProvider)
	);

	// Register sidebar tree view
	const treeView = vscode.window.createTreeView('gtmContainers', {
		treeDataProvider: sidebarProvider,
		showCollapseAll: true
	});
	context.subscriptions.push(treeView);

	// Register account tree view
	const accountProvider = new GtmAccountProvider();
	const accountTreeView = vscode.window.createTreeView('gtmAccount', {
		treeDataProvider: accountProvider
	});
	context.subscriptions.push(accountTreeView);

	// Refresh account info when auth sessions change (login/logout)
	context.subscriptions.push(
		authProvider.onDidChangeSessions(() => {
			accountProvider.refresh();
		})
	);

	// Update badge when modifications change
	const updateBadge = () => {
		const count = fsProvider.getModifiedFiles().length;
		treeView.badge = count > 0 ? { value: count, tooltip: `${count} pending change(s)` } : undefined;
	};

	// Set GTM files to use gtm-javascript language (no TypeScript validation)
	// GTM uses {{VAR}} syntax which is not valid JS
	context.subscriptions.push(
		vscode.workspace.onDidOpenTextDocument(async (doc) => {
			if (doc.uri.scheme === 'gtmsense' && doc.languageId !== 'gtm-javascript') {
				await vscode.languages.setTextDocumentLanguage(doc, 'gtm-javascript');
			}
			// Run ES5 diagnostics on GTM files
			if (doc.uri.scheme === 'gtmsense') {
				diagnosticsProvider.updateDiagnostics(doc);
			}
		})
	);

	// Update diagnostics when document changes
	context.subscriptions.push(
		vscode.workspace.onDidChangeTextDocument((event) => {
			if (event.document.uri.scheme === 'gtmsense') {
				diagnosticsProvider.updateDiagnostics(event.document);
			}
		})
	);

	// Clear diagnostics when document closes
	context.subscriptions.push(
		vscode.workspace.onDidCloseTextDocument((doc) => {
			if (doc.uri.scheme === 'gtmsense') {
				diagnosticsProvider.clearDiagnostics(doc);
			}
		})
	);

	// Command to load a container
	const loadContainerCommand = vscode.commands.registerCommand('gtmsense.loadContainer', async () => {
		try {
			// Step 1: Select account
			const accounts = await listAccounts();
			if (accounts.length === 0) {
				vscode.window.showErrorMessage('No GTM accounts found');
				return;
			}

			const accountPick = await vscode.window.showQuickPick(
				accounts.map(a => ({ label: a.name, path: a.path })),
				{ placeHolder: 'Select GTM Account' }
			);
			if (!accountPick) {
				return;
			}

			// Step 2: Select container
			const containers = await listContainers(accountPick.path);
			if (containers.length === 0) {
				vscode.window.showErrorMessage('No containers found');
				return;
			}

			const containerPick = await vscode.window.showQuickPick(
				containers.map(c => ({ label: c.name, description: c.publicId, path: c.path, publicId: c.publicId })),
				{ placeHolder: 'Select Container' }
			);
			if (!containerPick) {
				return;
			}

			// Step 3: Select or create workspace
			const workspaces = await listWorkspaces(containerPick.path);
			const workspaceItems = [
				{ label: '$(add) Create New Workspace', path: '', isNew: true },
				...workspaces.map(w => ({ label: w.name, path: w.path, isNew: false }))
			];

			const workspacePick = await vscode.window.showQuickPick(
				workspaceItems,
				{ placeHolder: 'Select Workspace' }
			);
			if (!workspacePick) {
				return;
			}

			let finalWorkspace: { name: string; path: string };

			if (workspacePick.isNew) {
				const newName = await vscode.window.showInputBox({
					prompt: 'Enter workspace name',
					placeHolder: 'My Workspace'
				});
				if (!newName) {
					return;
				}
				const created = await createWorkspace(containerPick.path, newName);
				finalWorkspace = { name: created.name, path: created.path };
				vscode.window.showInformationMessage(`Created workspace: ${newName}`);
			} else {
				finalWorkspace = { name: workspacePick.label, path: workspacePick.path };
			}

			// Check if this container + workspace combo is already loaded
			if (fsProvider.hasContainer(containerPick.label, finalWorkspace.name)) {
				vscode.window.showWarningMessage(`Container "${containerPick.label}" with workspace "${finalWorkspace.name}" is already loaded`);
				return;
			}

			// Add the container
			await fsProvider.addContainer(containerPick.label, containerPick.publicId, finalWorkspace.path, finalWorkspace.name);

			// Refresh sidebar
			sidebarProvider.refresh();

			vscode.window.showInformationMessage(`Loaded container: ${containerPick.label}`);
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to load container: ${error}`);
		}
	});

	// Command to unload a container
	const unloadContainerCommand = vscode.commands.registerCommand('gtmsense.unloadContainer', async () => {
		const containers = fsProvider.getContainers();
		if (containers.length === 0) {
			vscode.window.showInformationMessage('No containers loaded');
			return;
		}

		const pick = await vscode.window.showQuickPick(
			containers.map(c => ({ label: c.name, description: c.workspaceName })),
			{ placeHolder: 'Select container to remove' }
		);

		if (pick) {
			fsProvider.removeContainer(pick.label);
			sidebarProvider.refresh();
			vscode.window.showInformationMessage(`Unloaded container: ${pick.label}`);
		}
	});

	// Register completion provider for GTM variables
	const completionProvider = new GtmCompletionProvider(fsProvider);
	context.subscriptions.push(
		vscode.languages.registerCompletionItemProvider(
			{ language: 'gtm-javascript', scheme: 'gtmsense' },
			completionProvider,
			'{' // Trigger on {
		)
	);

	// Command to create a new tag
	const createTagCommand = vscode.commands.registerCommand('gtmsense.createTag', async (item?: { containerName?: string }) => {
		const containerKey = item?.containerName || await pickContainer(fsProvider);
		if (!containerKey) {
			return;
		}

		const container = fsProvider.getContainers().find(c => c.key === containerKey);
		if (!container) {
			vscode.window.showErrorMessage('Container not found');
			return;
		}

		const tagName = await vscode.window.showInputBox({
			prompt: 'Enter tag name',
			placeHolder: 'My Custom HTML Tag'
		});
		if (!tagName) {
			return;
		}

		try {
			const defaultCode = '<script>\n  // Your code here\n</script>';
			const tag = await createTag(container.workspacePath, tagName, defaultCode);
			await fsProvider.addFileEntry(container.key, 'tags', tag, 'tag');
			sidebarProvider.refresh();

			// Open the new file
			const uri = vscode.Uri.parse(`gtmsense:/${container.key}/tags/${fsProvider.sanitizeFileName(tagName)}.js`);
			await vscode.window.showTextDocument(uri);

			vscode.window.showInformationMessage(`Created tag: ${tagName}`);
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to create tag: ${error}`);
		}
	});

	// Command to create a new variable
	const createVariableCommand = vscode.commands.registerCommand('gtmsense.createVariable', async (item?: { containerName?: string }) => {
		const containerKey = item?.containerName || await pickContainer(fsProvider);
		if (!containerKey) {
			return;
		}

		const container = fsProvider.getContainers().find(c => c.key === containerKey);
		if (!container) {
			vscode.window.showErrorMessage('Container not found');
			return;
		}

		const varName = await vscode.window.showInputBox({
			prompt: 'Enter variable name',
			placeHolder: 'My Custom Variable'
		});
		if (!varName) {
			return;
		}

		try {
			const defaultCode = 'function() {\n  return undefined;\n}';
			const variable = await createVariable(container.workspacePath, varName, defaultCode);
			await fsProvider.addFileEntry(container.key, 'variables', variable, 'variable');
			sidebarProvider.refresh();

			// Open the new file
			const uri = vscode.Uri.parse(`gtmsense:/${container.key}/variables/${fsProvider.sanitizeFileName(varName)}.js`);
			await vscode.window.showTextDocument(uri);

			vscode.window.showInformationMessage(`Created variable: ${varName}`);
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to create variable: ${error}`);
		}
	});

	// Command to push all changes to GTM
	const pushChangesCommand = vscode.commands.registerCommand('gtmsense.pushChanges', async () => {
		if (!fsProvider.hasModifiedFiles()) {
			vscode.window.showInformationMessage('No changes to push');
			return;
		}

		const modifiedFiles = fsProvider.getModifiedFiles();
		const confirm = await vscode.window.showWarningMessage(
			`Push ${modifiedFiles.length} modified file(s) to GTM?`,
			{ modal: true },
			'Push'
		);

		if (confirm !== 'Push') {
			return;
		}

		try {
			const result = await fsProvider.pushChanges();
			sidebarProvider.refresh();

			if (result.failed === 0) {
				vscode.window.showInformationMessage(`Successfully pushed ${result.success} file(s) to GTM`);
			} else {
				vscode.window.showWarningMessage(`Pushed ${result.success} file(s), ${result.failed} failed`);
			}
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to push changes: ${error}`);
		}
	});

	// Command to discard all changes
	const discardChangesCommand = vscode.commands.registerCommand('gtmsense.discardChanges', async () => {
		if (!fsProvider.hasModifiedFiles()) {
			vscode.window.showInformationMessage('No changes to discard');
			return;
		}

		const modifiedFiles = fsProvider.getModifiedFiles();
		const confirm = await vscode.window.showWarningMessage(
			`Discard ${modifiedFiles.length} modified file(s)?`,
			{ modal: true },
			'Discard'
		);

		if (confirm !== 'Discard') {
			return;
		}

		fsProvider.discardChanges();
		sidebarProvider.refresh();
		vscode.window.showInformationMessage('All changes discarded');
	});

	// Command to delete a tag or variable
	const deleteItemCommand = vscode.commands.registerCommand('gtmsense.deleteItem', async (item?: { uri?: vscode.Uri }) => {
		if (!item?.uri) {
			vscode.window.showErrorMessage('No item selected');
			return;
		}

		const fileEntry = fsProvider.getFileEntry(item.uri);
		if (!fileEntry) {
			vscode.window.showErrorMessage('File not found');
			return;
		}

		const itemType = fileEntry.itemType === 'tag' ? 'tag' : 'variable';
		const itemName = fileEntry.gtmItem.name;

		const confirm = await vscode.window.showWarningMessage(
			`Delete ${itemType} "${itemName}" from GTM? This cannot be undone.`,
			{ modal: true },
			'Delete'
		);

		if (confirm !== 'Delete') {
			return;
		}

		try {
			await fsProvider.deleteFile(item.uri);
			sidebarProvider.refresh();
			vscode.window.showInformationMessage(`Deleted ${itemType}: ${itemName}`);
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to delete ${itemType}: ${error}`);
		}
	});

	// Command to discard changes for a specific item
	const discardItemChangesCommand = vscode.commands.registerCommand('gtmsense.discardItemChanges', async (item?: { uri?: vscode.Uri }) => {
		if (!item?.uri) {
			vscode.window.showErrorMessage('No item selected');
			return;
		}

		if (!fsProvider.isModified(item.uri)) {
			vscode.window.showInformationMessage('No changes to discard');
			return;
		}

		const fileEntry = fsProvider.getFileEntry(item.uri);
		const itemName = fileEntry?.gtmItem.name || 'this item';

		const confirm = await vscode.window.showWarningMessage(
			`Discard changes to "${itemName}"?`,
			{ modal: true },
			'Discard'
		);

		if (confirm !== 'Discard') {
			return;
		}

		fsProvider.discardChanges(item.uri);
		sidebarProvider.refresh();
		vscode.window.showInformationMessage(`Discarded changes to ${itemName}`);
	});

	// Command to rename a tag or variable
	const renameItemCommand = vscode.commands.registerCommand('gtmsense.renameItem', async (item?: { uri?: vscode.Uri }) => {
		if (!item?.uri) {
			vscode.window.showErrorMessage('No item selected');
			return;
		}

		const fileEntry = fsProvider.getFileEntry(item.uri);
		if (!fileEntry) {
			vscode.window.showErrorMessage('File not found');
			return;
		}

		const itemType = fileEntry.itemType === 'tag' ? 'tag' : 'variable';
		const currentName = fileEntry.gtmItem.name;

		const newName = await vscode.window.showInputBox({
			prompt: `Enter new name for ${itemType}`,
			value: currentName,
			validateInput: (value) => {
				if (!value || value.trim().length === 0) {
					return 'Name cannot be empty';
				}
				if (value === currentName) {
					return 'Name must be different from current name';
				}
				return undefined;
			}
		});

		if (!newName) {
			return;
		}

		try {
			const newUri = fsProvider.renameFile(item.uri, newName);
			sidebarProvider.refresh();

			// If the file was open, open the new file
			const activeEditor = vscode.window.activeTextEditor;
			if (activeEditor && activeEditor.document.uri.toString() === item.uri.toString()) {
				await vscode.window.showTextDocument(newUri);
			}

			vscode.window.showInformationMessage(`Renamed ${itemType}: ${currentName} → ${newName} (pending push)`);
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to rename ${itemType}: ${error}`);
		}
	});

	// Command to sign out
	const signOutCommand = vscode.commands.registerCommand('gtmsense.signOut', async () => {
		// Check for pending changes
		if (fsProvider.hasModifiedFiles()) {
			const modifiedCount = fsProvider.getModifiedFiles().length;
			const confirm = await vscode.window.showWarningMessage(
				`You have ${modifiedCount} unsaved change(s). Sign out anyway? Changes will be lost.`,
				{ modal: true },
				'Sign Out',
				'Cancel'
			);

			if (confirm !== 'Sign Out') {
				return;
			}
		} else {
			const confirm = await vscode.window.showWarningMessage(
				'Sign out of GTMSense? You will need to re-authenticate to use GTM.',
				{ modal: true },
				'Sign Out'
			);

			if (confirm !== 'Sign Out') {
				return;
			}
		}

		// Close all open gtmsense:// tabs
		const gtmTabs = vscode.window.tabGroups.all
			.flatMap(group => group.tabs)
			.filter(tab => {
				const input = tab.input;
				if (input && typeof input === 'object' && 'uri' in input) {
					const uri = input.uri as vscode.Uri;
					return uri.scheme === 'gtmsense';
				}
				return false;
			});

		for (const tab of gtmTabs) {
			await vscode.window.tabGroups.close(tab);
		}

		// Unload all containers
		const containers = fsProvider.getContainers();
		for (const container of containers) {
			fsProvider.removeContainer(container.key);
		}
		sidebarProvider.refresh();

		await authProvider.clearAllSessions();
		accountProvider.refresh();
		vscode.window.showInformationMessage('Signed out of GTMSense');
	});

	// Refresh sidebar and badge when modifications change
	context.subscriptions.push(
		fsProvider.onDidChangeModified(() => {
			sidebarProvider.refresh();
			updateBadge();
		})
	);

	context.subscriptions.push(loadContainerCommand, unloadContainerCommand, createTagCommand, createVariableCommand, pushChangesCommand, discardChangesCommand, deleteItemCommand, discardItemChangesCommand, renameItemCommand, signOutCommand);
}

async function pickContainer(fsProvider: GtmFileSystemProvider): Promise<string | undefined> {
	const containers = fsProvider.getContainers();
	if (containers.length === 0) {
		vscode.window.showErrorMessage('No containers loaded');
		return undefined;
	}
	if (containers.length === 1) {
		return containers[0].key;
	}
	const pick = await vscode.window.showQuickPick(
		containers.map(c => ({ label: c.name, description: `${c.workspaceName} (${c.publicId})`, key: c.key })),
		{ placeHolder: 'Select container' }
	);
	return pick?.key;
}

export function deactivate() {}
