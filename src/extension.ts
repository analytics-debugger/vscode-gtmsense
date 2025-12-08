import * as vscode from 'vscode';
import { GtmFileSystemProvider } from './fileSystemProvider';
import { GtmSidebarProvider } from './sidebarProvider';
import { GtmCompletionProvider } from './completionProvider';
// Template completion/hover now handled by Language Server in ./languageClient.ts
import { GtmDiagnosticsProvider } from './diagnosticsProvider';
import { GtmDecorationProvider } from './decorationProvider';
import { GtmAccountProvider } from './accountProvider';
import { GoogleAuthenticationProvider } from './auth';
import { listAccounts, listContainers, listWorkspaces, createWorkspace, createTag, createVariable, createTemplate, formatContainerType, getContainerTypeIcon } from './gtmClient';
import { isAuthenticated } from './auth';
import { activateLanguageClient, deactivateLanguageClient } from './languageClient';

let fsProvider: GtmFileSystemProvider;
let sidebarProvider: GtmSidebarProvider;
let diagnosticsProvider: GtmDiagnosticsProvider;
export let outputChannel: vscode.LogOutputChannel;

// Update the gtmsense.isLoggedIn context for conditional UI
async function updateLoginContext(): Promise<void> {
	const loggedIn = await isAuthenticated();
	await vscode.commands.executeCommand('setContext', 'gtmsense.isLoggedIn', loggedIn);
}

// Cache for accounts, containers, and workspaces
const cache = {
	accounts: null as Awaited<ReturnType<typeof listAccounts>> | null,
	containers: new Map<string, Awaited<ReturnType<typeof listContainers>>>(),
	workspaces: new Map<string, Awaited<ReturnType<typeof listWorkspaces>>>(),
};

async function getCachedAccounts(forceRefresh = false) {
	if (forceRefresh || !cache.accounts) {
		outputChannel.info(forceRefresh ? 'Refreshing accounts from API...' : 'Fetching accounts from API...');
		cache.accounts = await listAccounts();
	} else {
		outputChannel.info('Using cached accounts');
	}
	return cache.accounts;
}

async function getCachedContainers(accountPath: string, forceRefresh = false) {
	if (forceRefresh || !cache.containers.has(accountPath)) {
		outputChannel.info(forceRefresh ? 'Refreshing containers from API...' : 'Fetching containers from API...');
		cache.containers.set(accountPath, await listContainers(accountPath));
	} else {
		outputChannel.info('Using cached containers');
	}
	return cache.containers.get(accountPath)!;
}

async function getCachedWorkspaces(containerPath: string, forceRefresh = false) {
	if (forceRefresh || !cache.workspaces.has(containerPath)) {
		outputChannel.info(forceRefresh ? 'Refreshing workspaces from API...' : 'Fetching workspaces from API...');
		cache.workspaces.set(containerPath, await listWorkspaces(containerPath));
	} else {
		outputChannel.info('Using cached workspaces');
	}
	return cache.workspaces.get(containerPath)!;
}

export async function activate(context: vscode.ExtensionContext) {
	outputChannel = vscode.window.createOutputChannel('GTMSense', { log: true });
	const version = context.extension.packageJSON.version;
	outputChannel.info(`GTMSense Loaded:v${version} | VSCode v${vscode.version}`);

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

	// Activate GTM Language Server for template IntelliSense
	activateLanguageClient(context);

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
			updateLoginContext();
		})
	);

	// Set initial login context
	updateLoginContext();

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

	// Helper to show QuickPick with loading state
	async function showQuickPickWithLoading<T extends vscode.QuickPickItem>(
		placeholder: string,
		loadItems: () => Promise<T[]>
	): Promise<T | undefined> {
		return new Promise((resolve) => {
			const quickPick = vscode.window.createQuickPick<T>();
			quickPick.placeholder = placeholder;
			quickPick.busy = true;
			quickPick.enabled = false;
			quickPick.show();

			loadItems().then(items => {
				quickPick.items = items;
				quickPick.busy = false;
				quickPick.enabled = true;
			}).catch(err => {
				quickPick.hide();
				vscode.window.showErrorMessage(`Failed to load: ${err}`);
				resolve(undefined);
			});

			quickPick.onDidAccept(() => {
				const selected = quickPick.selectedItems[0];
				quickPick.hide();
				resolve(selected);
			});

			quickPick.onDidHide(() => {
				quickPick.dispose();
				resolve(undefined);
			});
		});
	}

	// Command to load a container
	const loadContainerCommand = vscode.commands.registerCommand('gtmsense.loadContainer', async () => {
		try {
			// Step 1: Select account (with loading)
			type AccountItem = vscode.QuickPickItem & { path: string; isRefresh: boolean };
			let accounts: Awaited<ReturnType<typeof listAccounts>> | null = null;

			selectAccount: while (true) {
				const accountPick = await showQuickPickWithLoading<AccountItem>(
					'Select GTM Account',
					async () => {
						if (!accounts) {
							accounts = await getCachedAccounts();
							outputChannel.info(`Fetched ${accounts.length} accounts`);
						}
						if (accounts.length === 0) {
							throw new Error('No GTM accounts found');
						}
						return [
							...accounts.map(a => ({ label: a.name, path: a.path, isRefresh: false })),
							{ label: '$(refresh) Refresh Accounts', path: '', isRefresh: true }
						];
					}
				);

				if (!accountPick) {
					return;
				}

				if (accountPick.isRefresh) {
					accounts = await getCachedAccounts(true);
					outputChannel.info(`Refreshed ${accounts.length} accounts`);
					continue;
				}

				// Step 2: Select container (with loading)
				type ContainerItem = vscode.QuickPickItem & { name: string; path: string; publicId: string; containerType: string; isSupported: boolean; isRefresh: boolean; isBack: boolean };
				let containers: Awaited<ReturnType<typeof listContainers>> | null = null;

				selectContainer: while (true) {
					const containerPick = await showQuickPickWithLoading<ContainerItem>(
						`Select Container (${accountPick.label})`,
						async () => {
							if (!containers) {
								containers = await getCachedContainers(accountPick.path);
							}
							if (containers.length === 0) {
								throw new Error('No containers found');
							}
							return [
								{ label: '$(arrow-left) Back to Accounts', name: '', path: '', publicId: '', containerType: '', isSupported: true, isRefresh: false, isBack: true },
								...containers.map(c => {
									const ctx = c.usageContext?.[0]?.toLowerCase();
									const isSupported = ctx === 'web' || ctx === 'server';
									const containerType = formatContainerType(c.usageContext);
									return {
										label: isSupported
											? `${getContainerTypeIcon(c.usageContext)} ${c.name}`
											: `$(circle-slash) ${c.name}`,
										name: c.name,
										description: containerType,
										detail: isSupported ? c.publicId : `${c.publicId} — not supported`,
										path: c.path,
										publicId: c.publicId,
										containerType,
										isSupported,
										isRefresh: false,
										isBack: false
									};
								}),
								{ label: '$(refresh) Refresh Containers', name: '', path: '', publicId: '', containerType: '', isSupported: true, isRefresh: true, isBack: false }
							];
						}
					);

					if (!containerPick) {
						return;
					}

					if (containerPick.isBack) {
						containers = null; // Reset so it reloads
						continue selectAccount;
					}

					if (containerPick.isRefresh) {
						containers = null; // Will reload on next iteration
						continue;
					}

					if (!containerPick.isSupported) {
						vscode.window.showWarningMessage(`GTMSense only supports Web and Server containers. "${containerPick.containerType}" containers are not supported.`);
						continue;
					}

					// Step 3: Select or create workspace (with loading)
					type WorkspaceItem = vscode.QuickPickItem & { path: string; isNew: boolean; isRefresh: boolean; isBack: boolean };
					let workspaces: Awaited<ReturnType<typeof listWorkspaces>> | null = null;

					selectWorkspace: while (true) {
						const workspacePick = await showQuickPickWithLoading<WorkspaceItem>(
							`Select Workspace (${containerPick.name})`,
							async () => {
								if (!workspaces) {
									workspaces = await getCachedWorkspaces(containerPick.path);
								}
								return [
									{ label: '$(arrow-left) Back to Containers', description: '', path: '', isNew: false, isRefresh: false, isBack: true },
									{ label: '$(add) Create New Workspace', description: '', path: '', isNew: true, isRefresh: false, isBack: false },
									...workspaces.map(w => ({ label: w.name, description: '', path: w.path, isNew: false, isRefresh: false, isBack: false })),
									{ label: '$(refresh) Refresh Workspaces', description: '', path: '', isNew: false, isRefresh: true, isBack: false }
								];
							}
						);

						if (!workspacePick) {
							return;
						}

						if (workspacePick.isBack) {
							continue selectContainer;
						}

						if (workspacePick.isRefresh) {
							workspaces = null; // Will reload on next iteration
							cache.workspaces.delete(containerPick.path);
							continue;
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
							const created = await vscode.window.withProgress(
								{ location: vscode.ProgressLocation.Notification, title: 'Creating workspace...' },
								async () => createWorkspace(containerPick.path, newName)
							);
							// Invalidate workspace cache after creating new one
							cache.workspaces.delete(containerPick.path);
							finalWorkspace = { name: created.name, path: created.path };
							vscode.window.showInformationMessage(`Created workspace: ${newName}`);
						} else {
							finalWorkspace = { name: workspacePick.label, path: workspacePick.path };
						}

						// Check if this container + workspace combo is already loaded
						if (fsProvider.hasContainer(containerPick.name, finalWorkspace.name)) {
							vscode.window.showWarningMessage(`Container "${containerPick.name}" with workspace "${finalWorkspace.name}" is already loaded`);
							return;
						}

						// Add the container
						await vscode.window.withProgress(
							{ location: vscode.ProgressLocation.Notification, title: 'Loading container...' },
							async () => fsProvider.addContainer(containerPick.name, containerPick.publicId, finalWorkspace.path, finalWorkspace.name, containerPick.containerType)
						);

						// Refresh sidebar
						sidebarProvider.refresh();

						vscode.window.showInformationMessage(`Loaded container: ${containerPick.name}`);

						// Break out of all loops after successful load
						break selectAccount;
					} // end selectWorkspace loop
				} // end selectContainer loop
			} // end selectAccount loop
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

	// Register completion provider for GTM variables ({{var}} syntax)
	// Note: Template API completions (require, hover, signature help) are handled by the Language Server
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
			const tag = await vscode.window.withProgress(
				{ location: vscode.ProgressLocation.Notification, title: 'Creating tag...' },
				async () => createTag(container.workspacePath, tagName, defaultCode)
			);
			await fsProvider.addFileEntry(container.key, 'tags', tag, 'tag');
			sidebarProvider.refresh();

			// Open the new file
			const uri = vscode.Uri.from({ scheme: 'gtmsense', path: `/${container.key}/tags/${fsProvider.sanitizeFileName(tagName)}.js` });
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
			const variable = await vscode.window.withProgress(
				{ location: vscode.ProgressLocation.Notification, title: 'Creating variable...' },
				async () => createVariable(container.workspacePath, varName, defaultCode)
			);
			await fsProvider.addFileEntry(container.key, 'variables', variable, 'variable');
			sidebarProvider.refresh();

			// Open the new file
			const uri = vscode.Uri.from({ scheme: 'gtmsense', path: `/${container.key}/variables/${fsProvider.sanitizeFileName(varName)}.js` });
			await vscode.window.showTextDocument(uri);

			vscode.window.showInformationMessage(`Created variable: ${varName}`);
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to create variable: ${error}`);
		}
	});

	// Command to create a new template
	const createTemplateCommand = vscode.commands.registerCommand('gtmsense.createTemplate', async (item?: { containerName?: string }) => {
		const containerKey = item?.containerName || await pickContainer(fsProvider);
		if (!containerKey) {
			return;
		}

		const container = fsProvider.getContainers().find(c => c.key === containerKey);
		if (!container) {
			vscode.window.showErrorMessage('Container not found');
			return;
		}

		// Ask for template kind (Tag or Variable)
		const templateKindPick = await vscode.window.showQuickPick(
			[
				{ label: '$(tag) Tag Template', description: 'Create a custom tag template', value: 'tag' as const },
				{ label: '$(symbol-variable) Variable Template', description: 'Create a custom variable (macro) template', value: 'variable' as const }
			],
			{ placeHolder: 'Select template type' }
		);
		if (!templateKindPick) {
			return;
		}

		const templateName = await vscode.window.showInputBox({
			prompt: `Enter ${templateKindPick.value} template name`,
			placeHolder: templateKindPick.value === 'tag' ? 'My Custom Tag Template' : 'My Custom Variable Template'
		});
		if (!templateName) {
			return;
		}

		// Determine container context from container type
		const containerTypeLower = container.containerType.toLowerCase();
		const containerContext: 'web' | 'server' = containerTypeLower.includes('server') ? 'server' : 'web';

		try {
			const template = await vscode.window.withProgress(
				{ location: vscode.ProgressLocation.Notification, title: 'Creating template...' },
				async () => createTemplate(container.workspacePath, templateName, containerContext, templateKindPick.value)
			);
			const jsFileName = fsProvider.addTemplateEntry(container.key, template);
			sidebarProvider.refresh();

			// Open the JS section file
			if (jsFileName) {
				const uri = vscode.Uri.from({
					scheme: 'gtmsense',
					path: `/${container.key}/templates/${fsProvider.sanitizeFileName(templateName)}/${jsFileName}`
				});
				await vscode.window.showTextDocument(uri);
			}

			vscode.window.showInformationMessage(`Created template: ${templateName}`);
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to create template: ${error}`);
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

		// Get unique container keys that have modified files (to reload after push)
		const affectedContainerKeys = [...new Set(modifiedFiles.map(f => f.containerName))];

		try {
			const result = await vscode.window.withProgress(
				{ location: vscode.ProgressLocation.Notification, title: 'Pushing changes to GTM...', cancellable: false },
				async () => fsProvider.pushChanges()
			);

			if (result.failed === 0) {
				// Reload all affected workspaces to get fresh data from API
				await vscode.window.withProgress(
					{ location: vscode.ProgressLocation.Notification, title: 'Reloading workspaces...', cancellable: false },
					async () => {
						for (const containerKey of affectedContainerKeys) {
							const container = fsProvider.getContainers().find(c => c.key === containerKey);
							if (container) {
								// Close any open files from this workspace
								const gtmTabs = vscode.window.tabGroups.all
									.flatMap(group => group.tabs)
									.filter(tab => {
										const input = tab.input;
										if (input && typeof input === 'object' && 'uri' in input) {
											const uri = input.uri as vscode.Uri;
											return uri.scheme === 'gtmsense' && uri.path.startsWith(`/${containerKey}/`);
										}
										return false;
									});

								for (const tab of gtmTabs) {
									await vscode.window.tabGroups.close(tab);
								}

								// Remove and re-add the container
								fsProvider.removeContainer(containerKey);
								await fsProvider.addContainer(container.name, container.publicId, container.workspacePath, container.workspaceName, container.containerType);
							}
						}
					}
				);

				sidebarProvider.refresh();
				vscode.window.showInformationMessage(`Successfully pushed ${result.success} file(s) to GTM`);
			} else {
				sidebarProvider.refresh();
				for (const err of result.errors) {
					outputChannel.error(`${err.fileName}: ${err.error}`);
				}
				outputChannel.show();
				vscode.window.showErrorMessage(`Push failed: ${result.success} succeeded, ${result.failed} failed. See output for details.`);
			}
		} catch (error) {
			outputChannel.error(`Failed to push changes: ${error}`);
			outputChannel.show();
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

	// Command to delete a tag, variable, or template
	const deleteItemCommand = vscode.commands.registerCommand('gtmsense.deleteItem', async (item?: { uri?: vscode.Uri; itemType?: string; containerName?: string; templateName?: string }) => {
		// Handle template deletion (from template tree item)
		if (item?.itemType === 'template' && item.containerName && item.templateName) {
			const confirm = await vscode.window.showWarningMessage(
				`Delete template "${item.templateName}" from GTM? This cannot be undone.`,
				{ modal: true },
				'Delete'
			);

			if (confirm !== 'Delete') {
				return;
			}

			try {
				await vscode.window.withProgress(
					{ location: vscode.ProgressLocation.Notification, title: 'Deleting template...' },
					async () => fsProvider.deleteTemplateByName(item.containerName!, item.templateName!)
				);
				sidebarProvider.refresh();
				vscode.window.showInformationMessage(`Deleted template: ${item.templateName}`);
			} catch (error) {
				vscode.window.showErrorMessage(`Failed to delete template: ${error}`);
			}
			return;
		}

		// Handle tag/variable deletion (from file tree item)
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
			await vscode.window.withProgress(
				{ location: vscode.ProgressLocation.Notification, title: `Deleting ${itemType}...` },
				async () => fsProvider.deleteFile(item.uri!)
			);
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

	// Command to rename a tag, variable, or template
	const renameItemCommand = vscode.commands.registerCommand('gtmsense.renameItem', async (item?: { uri?: vscode.Uri; itemType?: string; containerName?: string; templateName?: string }) => {
		// Handle template rename
		if (item?.itemType === 'template' && item.containerName && item.templateName) {
			const template = fsProvider.getTemplate(item.containerName, item.templateName);
			if (!template) {
				vscode.window.showErrorMessage('Template not found');
				return;
			}

			const currentName = template.name;
			const newName = await vscode.window.showInputBox({
				prompt: 'Enter new name for template',
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
				fsProvider.renameTemplate(item.containerName, item.templateName, newName);
				sidebarProvider.refresh();
				vscode.window.showInformationMessage(`Renamed template: ${currentName} → ${newName} (pending push)`);
			} catch (error) {
				vscode.window.showErrorMessage(`Failed to rename template: ${error}`);
			}
			return;
		}

		// Handle tag/variable rename
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
		updateLoginContext();
		vscode.window.showInformationMessage('Signed out of GTMSense');
	});

	// Command to sign in
	const signInCommand = vscode.commands.registerCommand('gtmsense.signIn', async () => {
		try {
			// This will trigger the auth flow
			await vscode.authentication.getSession('gtm-google', [
				'https://www.googleapis.com/auth/tagmanager.edit.containers',
				'https://www.googleapis.com/auth/userinfo.email'
			], { createIfNone: true });
			accountProvider.refresh();
			updateLoginContext();
		} catch (error) {
			vscode.window.showErrorMessage(`Sign in failed: ${error}`);
		}
	});

	// Command to create a new workspace for a container
	const createWorkspaceCommand = vscode.commands.registerCommand('gtmsense.createWorkspace', async (item?: { label?: string; containerName?: string; publicId?: string }) => {
		// Get the container name from the tree item
		const containerName = item?.label || item?.containerName;
		if (!containerName) {
			vscode.window.showErrorMessage('No container selected');
			return;
		}

		// Find a loaded container with this name to get the container path
		const containers = fsProvider.getContainers();
		const existingContainer = containers.find(c => c.name === containerName);

		if (!existingContainer) {
			vscode.window.showErrorMessage(`Container "${containerName}" is not loaded. Load a workspace first.`);
			return;
		}

		// Extract container path from workspace path (format: accounts/.../containers/.../workspaces/...)
		const workspacePathParts = existingContainer.workspacePath.split('/');
		const workspacesIndex = workspacePathParts.indexOf('workspaces');
		if (workspacesIndex === -1) {
			vscode.window.showErrorMessage('Invalid workspace path format');
			return;
		}
		const containerPath = workspacePathParts.slice(0, workspacesIndex).join('/');

		const workspaceName = await vscode.window.showInputBox({
			prompt: 'Enter workspace name',
			placeHolder: 'My New Workspace'
		});
		if (!workspaceName) {
			return;
		}

		try {
			const created = await vscode.window.withProgress(
				{ location: vscode.ProgressLocation.Notification, title: 'Creating workspace...' },
				async () => createWorkspace(containerPath, workspaceName)
			);
			// Invalidate workspace cache
			cache.workspaces.delete(containerPath);

			// Check if this workspace is already loaded
			if (fsProvider.hasContainer(containerName, workspaceName)) {
				vscode.window.showWarningMessage(`Workspace "${workspaceName}" already loaded`);
				return;
			}

			// Load the new workspace
			await vscode.window.withProgress(
				{ location: vscode.ProgressLocation.Notification, title: 'Loading workspace...' },
				async () => fsProvider.addContainer(containerName, existingContainer.publicId, created.path, created.name, existingContainer.containerType)
			);
			sidebarProvider.refresh();

			vscode.window.showInformationMessage(`Created and loaded workspace: ${workspaceName}`);
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to create workspace: ${error}`);
		}
	});

	// Command to reload a workspace (refresh from GTM API)
	const reloadWorkspaceCommand = vscode.commands.registerCommand('gtmsense.reloadWorkspace', async (item?: { containerName?: string; workspaceName?: string }) => {
		if (!item?.containerName) {
			vscode.window.showErrorMessage('No workspace selected');
			return;
		}

		const containerKey = item.containerName; // This is actually the container key (e.g., "Container Name (Workspace)")
		const container = fsProvider.getContainers().find(c => c.key === containerKey);

		if (!container) {
			vscode.window.showErrorMessage('Workspace not found');
			return;
		}

		// Check for pending changes in this workspace
		const modifiedFiles = fsProvider.getModifiedFilesForContainer(containerKey);
		if (modifiedFiles.length > 0) {
			const confirm = await vscode.window.showWarningMessage(
				`You have ${modifiedFiles.length} unpushed change(s) in "${container.workspaceName}". Reloading will discard these changes.`,
				{ modal: true },
				'Reload Anyway',
				'Cancel'
			);

			if (confirm !== 'Reload Anyway') {
				return;
			}
		}

		try {
			// Close any open files from this workspace
			const gtmTabs = vscode.window.tabGroups.all
				.flatMap(group => group.tabs)
				.filter(tab => {
					const input = tab.input;
					if (input && typeof input === 'object' && 'uri' in input) {
						const uri = input.uri as vscode.Uri;
						return uri.scheme === 'gtmsense' && uri.path.startsWith(`/${containerKey}/`);
					}
					return false;
				});

			for (const tab of gtmTabs) {
				await vscode.window.tabGroups.close(tab);
			}

			// Remove the container
			fsProvider.removeContainer(containerKey);

			// Re-add the container (this will fetch fresh data from the API)
			await vscode.window.withProgress(
				{ location: vscode.ProgressLocation.Notification, title: `Reloading workspace "${container.workspaceName}"...` },
				async () => fsProvider.addContainer(container.name, container.publicId, container.workspacePath, container.workspaceName, container.containerType)
			);

			sidebarProvider.refresh();
			vscode.window.showInformationMessage(`Reloaded workspace: ${container.workspaceName}`);
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to reload workspace: ${error}`);
		}
	});

	// Refresh sidebar and badge when modifications change
	context.subscriptions.push(
		fsProvider.onDidChangeModified(() => {
			sidebarProvider.refresh();
			updateBadge();
		})
	);

	context.subscriptions.push(loadContainerCommand, unloadContainerCommand, createTagCommand, createVariableCommand, createTemplateCommand, createWorkspaceCommand, reloadWorkspaceCommand, pushChangesCommand, discardChangesCommand, deleteItemCommand, discardItemChangesCommand, renameItemCommand, signOutCommand, signInCommand);
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

export function deactivate(): Thenable<void> | undefined {
	return deactivateLanguageClient();
}
