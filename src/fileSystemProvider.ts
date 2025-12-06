import * as vscode from 'vscode';
import {
	GtmTag,
	GtmVariable,
	GtmTemplate,
	listTags,
	listVariables,
	listTemplates,
	updateTag,
	updateVariable,
	updateTemplate,
	deleteTag,
	deleteVariable,
	extractCode,
	updateCode,
	parseTemplateSections,
	updateTemplateSection,
} from './gtmClient';

interface FileEntry {
	type: 'file';
	name: string;
	data: Uint8Array;
	ctime: number;
	mtime: number;
	gtmItem: GtmTag | GtmVariable | GtmTemplate;
	itemType: 'tag' | 'variable' | 'template-section';
	sectionName?: string; // For template sections, the section name (e.g., "SANDBOXED_JS_FOR_WEB_TEMPLATE")
}

interface DirectoryEntry {
	type: 'directory';
	name: string;
	ctime: number;
	mtime: number;
	entries: Map<string, FileEntry | DirectoryEntry>;
}

type Entry = FileEntry | DirectoryEntry;

export interface ContainerInfo {
	name: string;
	publicId: string; // GTM-XXXXXX
	workspacePath: string;
	workspaceName: string;
	key: string; // Unique key: "containerName (workspaceName)"
}

export interface ModifiedFile {
	uri: vscode.Uri;
	containerName: string;
	folder: 'tags' | 'variables' | 'templates';
	fileName: string;
	itemType: 'tag' | 'variable' | 'template-section';
	gtmItem: GtmTag | GtmVariable | GtmTemplate;
	newCode: string;
	newName?: string; // If renamed, the new name
	sectionName?: string; // For template sections
}

export class GtmFileSystemProvider implements vscode.FileSystemProvider {
	private root: DirectoryEntry;
	private containers: Map<string, ContainerInfo> = new Map();
	private variableNames: Map<string, string[]> = new Map(); // containerName -> variable names
	private modifiedFiles: Map<string, ModifiedFile> = new Map(); // uri.toString() -> ModifiedFile

	private _emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
	readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this._emitter.event;

	private _onDidChangeModified = new vscode.EventEmitter<void>();
	readonly onDidChangeModified: vscode.Event<void> = this._onDidChangeModified.event;

	// Extract code from any GTM item type (for template sections, this is called with the section content already)
	private extractItemCode(item: GtmTag | GtmVariable | GtmTemplate, itemType: 'tag' | 'variable' | 'template-section', sectionName?: string): string {
		if (itemType === 'template-section' && sectionName) {
			// For template sections, find and return the section content
			const sections = parseTemplateSections((item as GtmTemplate).templateData || '');
			const section = sections.find(s => s.name === sectionName);
			return section?.content || '';
		}
		return extractCode(item as GtmTag | GtmVariable);
	}

	constructor() {
		this.root = {
			type: 'directory',
			name: '',
			ctime: Date.now(),
			mtime: Date.now(),
			entries: new Map(),
		};
	}

	async addContainer(containerName: string, publicId: string, workspacePath: string, workspaceName: string): Promise<void> {
		console.log(`Adding container: ${containerName} (${publicId}, workspace: ${workspaceName})`);

		// Use a unique key for container + workspace combination
		const containerKey = `${containerName} (${workspaceName})`;

		// Create container directory
		const containerDir: DirectoryEntry = {
			type: 'directory',
			name: containerKey,
			ctime: Date.now(),
			mtime: Date.now(),
			entries: new Map(),
		};

		// Create tags and variables subdirectories
		const tagsDir: DirectoryEntry = {
			type: 'directory',
			name: 'tags',
			ctime: Date.now(),
			mtime: Date.now(),
			entries: new Map(),
		};

		const variablesDir: DirectoryEntry = {
			type: 'directory',
			name: 'variables',
			ctime: Date.now(),
			mtime: Date.now(),
			entries: new Map(),
		};

		const templatesDir: DirectoryEntry = {
			type: 'directory',
			name: 'templates',
			ctime: Date.now(),
			mtime: Date.now(),
			entries: new Map(),
		};

		// Fetch tags, variables, and templates
		const [tags, variables, templates] = await Promise.all([
			listTags(workspacePath),
			listVariables(workspacePath),
			listTemplates(workspacePath),
		]);

		console.log(`Found ${tags.length} tags, ${variables.length} variables, and ${templates.length} templates for ${containerName}`);

		// Add tags as files
		for (const tag of tags) {
			const code = extractCode(tag);
			console.log(`Tag "${tag.name}" (${tag.type}): ${code ? 'has code' : 'no code'}`);
			if (code) {
				const fileName = this.sanitizeFileName(tag.name) + '.js';
				const entry: FileEntry = {
					type: 'file',
					name: fileName,
					data: new TextEncoder().encode(code),
					ctime: Date.now(),
					mtime: Date.now(),
					gtmItem: tag,
					itemType: 'tag',
				};
				tagsDir.entries.set(fileName, entry);
			}
		}

		// Store all variable names for autocomplete (before filtering by code)
		this.variableNames.set(containerKey, variables.map(v => v.name));

		// Add variables as files
		for (const variable of variables) {
			const code = extractCode(variable);
			console.log(`Variable "${variable.name}" (${variable.type}): ${code ? 'has code' : 'no code'}`);
			if (code) {
				const fileName = this.sanitizeFileName(variable.name) + '.js';
				const entry: FileEntry = {
					type: 'file',
					name: fileName,
					data: new TextEncoder().encode(code),
					ctime: Date.now(),
					mtime: Date.now(),
					gtmItem: variable,
					itemType: 'variable',
				};
				variablesDir.entries.set(fileName, entry);
			}
		}

		// Add templates as folders, each containing section files
		for (const template of templates) {
			const sections = parseTemplateSections(template.templateData || '');
			if (sections.length > 0) {
				const templateDirName = this.sanitizeFileName(template.name);
				const templateDir: DirectoryEntry = {
					type: 'directory',
					name: templateDirName,
					ctime: Date.now(),
					mtime: Date.now(),
					entries: new Map(),
				};

				// Add each section as a file
				for (const section of sections) {
					const sectionFileName = section.name + section.extension;
					const sectionEntry: FileEntry = {
						type: 'file',
						name: sectionFileName,
						data: new TextEncoder().encode(section.content),
						ctime: Date.now(),
						mtime: Date.now(),
						gtmItem: template,
						itemType: 'template-section',
						sectionName: section.name,
					};
					templateDir.entries.set(sectionFileName, sectionEntry);
				}

				templatesDir.entries.set(templateDirName, templateDir);
			}
		}

		containerDir.entries.set('tags', tagsDir);
		containerDir.entries.set('variables', variablesDir);
		containerDir.entries.set('templates', templatesDir);

		// Add container to root
		this.root.entries.set(containerKey, containerDir);
		this.containers.set(containerKey, { name: containerName, publicId, workspacePath, workspaceName, key: containerKey });

		console.log(`Loaded ${tagsDir.entries.size} tags, ${variablesDir.entries.size} variables, and ${templatesDir.entries.size} templates for ${containerKey}`);

		// Fire change events
		this._emitter.fire([{ type: vscode.FileChangeType.Changed, uri: vscode.Uri.from({ scheme: 'gtmsense', path: '/' }) }]);
	}

	removeContainer(containerName: string): void {
		this.root.entries.delete(containerName);
		this.containers.delete(containerName);
		this.variableNames.delete(containerName);
		this._emitter.fire([{ type: vscode.FileChangeType.Deleted, uri: vscode.Uri.from({ scheme: 'gtmsense', path: `/${containerName}` }) }]);
	}

	getContainers(): ContainerInfo[] {
		return Array.from(this.containers.values());
	}

	hasContainer(containerName: string, workspaceName: string): boolean {
		const containerKey = `${containerName} (${workspaceName})`;
		return this.containers.has(containerKey);
	}

	getVariableNames(containerName: string): string[] {
		return this.variableNames.get(containerName) || [];
	}

	getAllVariableNames(): string[] {
		const allNames = new Set<string>();
		for (const names of this.variableNames.values()) {
			for (const name of names) {
				allNames.add(name);
			}
		}
		return Array.from(allNames);
	}

	getContainerFromUri(uri: vscode.Uri): string | undefined {
		const parts = uri.path.split('/').filter(p => p);
		return parts.length > 0 ? decodeURIComponent(parts[0]) : undefined;
	}

	sanitizeFileName(name: string): string {
		return name.replace(/[<>:"/\\|?*]/g, '_').trim();
	}

	addFileEntry(containerName: string, folder: 'tags' | 'variables', item: GtmTag | GtmVariable, itemType: 'tag' | 'variable'): void {
		const containerDir = this.root.entries.get(containerName);
		if (!containerDir || containerDir.type !== 'directory') {
			throw new Error(`Container ${containerName} not found`);
		}

		const folderDir = containerDir.entries.get(folder);
		if (!folderDir || folderDir.type !== 'directory') {
			throw new Error(`Folder ${folder} not found`);
		}

		const code = extractCode(item);
		const fileName = this.sanitizeFileName(item.name) + '.js';
		const entry: FileEntry = {
			type: 'file',
			name: fileName,
			data: new TextEncoder().encode(code),
			ctime: Date.now(),
			mtime: Date.now(),
			gtmItem: item,
			itemType,
		};
		folderDir.entries.set(fileName, entry);

		// Update variable names cache if it's a variable
		if (itemType === 'variable') {
			const names = this.variableNames.get(containerName) || [];
			names.push(item.name);
			this.variableNames.set(containerName, names);
		}

		this._emitter.fire([{ type: vscode.FileChangeType.Created, uri: vscode.Uri.from({ scheme: 'gtmsense', path: `/${containerName}/${folder}/${fileName}` }) }]);
	}

	addTemplateEntry(containerName: string, template: GtmTemplate): string {
		const containerDir = this.root.entries.get(containerName);
		if (!containerDir || containerDir.type !== 'directory') {
			throw new Error(`Container ${containerName} not found`);
		}

		const templatesDir = containerDir.entries.get('templates');
		if (!templatesDir || templatesDir.type !== 'directory') {
			throw new Error('Templates folder not found');
		}

		const sections = parseTemplateSections(template.templateData || '');
		const templateDirName = this.sanitizeFileName(template.name);
		const templateDir: DirectoryEntry = {
			type: 'directory',
			name: templateDirName,
			ctime: Date.now(),
			mtime: Date.now(),
			entries: new Map(),
		};

		// Find the JS section to open
		let jsFileName = '';

		// Add each section as a file
		for (const section of sections) {
			const sectionFileName = section.name + section.extension;
			const sectionEntry: FileEntry = {
				type: 'file',
				name: sectionFileName,
				data: new TextEncoder().encode(section.content),
				ctime: Date.now(),
				mtime: Date.now(),
				gtmItem: template,
				itemType: 'template-section',
				sectionName: section.name,
			};
			templateDir.entries.set(sectionFileName, sectionEntry);

			// Track the JS section file
			if (section.name.includes('SANDBOXED_JS')) {
				jsFileName = sectionFileName;
			}
		}

		templatesDir.entries.set(templateDirName, templateDir);

		this._emitter.fire([{ type: vscode.FileChangeType.Created, uri: vscode.Uri.from({ scheme: 'gtmsense', path: `/${containerName}/templates/${templateDirName}` }) }]);

		return jsFileName;
	}

	private lookup(uri: vscode.Uri): Entry | undefined {
		const parts = uri.path.split('/').filter(p => p).map(p => decodeURIComponent(p));
		let entry: Entry = this.root;

		for (const part of parts) {
			if (entry.type !== 'directory') {
				return undefined;
			}
			const child = entry.entries.get(part);
			if (!child) {
				return undefined;
			}
			entry = child;
		}

		return entry;
	}

	private lookupAsFile(uri: vscode.Uri): FileEntry {
		const entry = this.lookup(uri);
		if (!entry || entry.type !== 'file') {
			throw vscode.FileSystemError.FileNotFound(uri);
		}
		return entry;
	}

	private lookupAsDirectory(uri: vscode.Uri): DirectoryEntry {
		const entry = this.lookup(uri);
		if (!entry || entry.type !== 'directory') {
			throw vscode.FileSystemError.FileNotADirectory(uri);
		}
		return entry;
	}

	watch(): vscode.Disposable {
		return new vscode.Disposable(() => {});
	}

	stat(uri: vscode.Uri): vscode.FileStat {
		const entry = this.lookup(uri);
		if (!entry) {
			throw vscode.FileSystemError.FileNotFound(uri);
		}

		return {
			type: entry.type === 'directory' ? vscode.FileType.Directory : vscode.FileType.File,
			ctime: entry.ctime,
			mtime: entry.mtime,
			size: entry.type === 'file' ? entry.data.length : 0,
		};
	}

	readDirectory(uri: vscode.Uri): [string, vscode.FileType][] {
		const entry = this.lookupAsDirectory(uri);
		const result: [string, vscode.FileType][] = [];

		for (const [name, child] of entry.entries) {
			result.push([name, child.type === 'directory' ? vscode.FileType.Directory : vscode.FileType.File]);
		}

		return result;
	}

	readFile(uri: vscode.Uri): Uint8Array {
		const entry = this.lookupAsFile(uri);
		return entry.data;
	}

	async writeFile(uri: vscode.Uri, content: Uint8Array): Promise<void> {
		const entry = this.lookupAsFile(uri);
		const newCode = new TextDecoder().decode(content);
		const originalCode = this.extractItemCode(entry.gtmItem, entry.itemType, entry.sectionName);

		// Update local cache
		entry.data = content;
		entry.mtime = Date.now();

		// Track as modified (or remove if reverted to original)
		const parts = uri.path.split('/').filter(p => p);
		const containerName = decodeURIComponent(parts[0]);
		const folder = parts[1] as 'tags' | 'variables' | 'templates';

		// Check if there's an existing modification (e.g., a rename)
		const existingModified = this.modifiedFiles.get(uri.toString());
		const hasNameChange = existingModified?.newName !== undefined;

		if (newCode !== originalCode || hasNameChange) {
			this.modifiedFiles.set(uri.toString(), {
				uri,
				containerName,
				folder,
				fileName: entry.name,
				itemType: entry.itemType,
				gtmItem: entry.gtmItem,
				newCode,
				newName: existingModified?.newName, // Preserve any existing name change
				sectionName: entry.sectionName, // For template sections
			});
		} else {
			this.modifiedFiles.delete(uri.toString());
		}

		this._onDidChangeModified.fire();
		this._emitter.fire([{ type: vscode.FileChangeType.Changed, uri }]);
	}

	createDirectory(): void {
		throw vscode.FileSystemError.NoPermissions('Cannot create directories in GTM workspace');
	}

	delete(): void {
		throw vscode.FileSystemError.NoPermissions('Use GTM: Delete Tag/Variable command instead');
	}

	rename(): void {
		throw vscode.FileSystemError.NoPermissions('Cannot rename files in GTM workspace');
	}

	async deleteFile(uri: vscode.Uri): Promise<void> {
		const entry = this.lookupAsFile(uri);
		const parts = uri.path.split('/').filter(p => p);
		const containerName = decodeURIComponent(parts[0]);
		const folder = parts[1] as 'tags' | 'variables';

		// Delete from GTM
		if (entry.itemType === 'tag') {
			await deleteTag(entry.gtmItem.path);
		} else {
			await deleteVariable(entry.gtmItem.path);
		}

		// Remove from local cache
		const containerDir = this.root.entries.get(containerName);
		if (containerDir && containerDir.type === 'directory') {
			const folderDir = containerDir.entries.get(folder);
			if (folderDir && folderDir.type === 'directory') {
				folderDir.entries.delete(entry.name);
			}
		}

		// Remove from modified files if present
		this.modifiedFiles.delete(uri.toString());

		// Update variable names cache if it was a variable
		if (entry.itemType === 'variable') {
			const names = this.variableNames.get(containerName) || [];
			const itemName = (entry.gtmItem as GtmVariable).name;
			this.variableNames.set(containerName, names.filter(n => n !== itemName));
		}

		this._onDidChangeModified.fire();
		this._emitter.fire([{ type: vscode.FileChangeType.Deleted, uri }]);
	}

	getFileEntry(uri: vscode.Uri): FileEntry | undefined {
		const entry = this.lookup(uri);
		if (entry && entry.type === 'file') {
			return entry;
		}
		return undefined;
	}

	getModifiedFiles(): ModifiedFile[] {
		return Array.from(this.modifiedFiles.values());
	}

	getModifiedFilesForContainer(containerName: string): ModifiedFile[] {
		return this.getModifiedFiles().filter(f => f.containerName === containerName);
	}

	isModified(uri: vscode.Uri): boolean {
		return this.modifiedFiles.has(uri.toString());
	}

	hasModifiedFiles(): boolean {
		return this.modifiedFiles.size > 0;
	}

	async pushChanges(): Promise<{ success: number; failed: number; errors: Array<{ fileName: string; error: string }> }> {
		let success = 0;
		let failed = 0;
		const errors: Array<{ fileName: string; error: string }> = [];

		// Group template section changes by template path
		const templateChanges = new Map<string, { template: GtmTemplate; sections: Map<string, string> }>();

		for (const modified of this.modifiedFiles.values()) {
			if (modified.itemType === 'template-section' && modified.sectionName) {
				const templatePath = modified.gtmItem.path;
				if (!templateChanges.has(templatePath)) {
					templateChanges.set(templatePath, {
						template: modified.gtmItem as GtmTemplate,
						sections: new Map(),
					});
				}
				templateChanges.get(templatePath)!.sections.set(modified.sectionName, modified.newCode);
			}
		}

		// Push template changes (grouped by template)
		for (const [templatePath, { template, sections }] of templateChanges) {
			try {
				let updatedTemplateData = template.templateData;
				for (const [sectionName, newContent] of sections) {
					updatedTemplateData = updateTemplateSection(updatedTemplateData, sectionName, newContent);
				}
				const updatedTemplate: Partial<GtmTemplate> = {
					...template,
					templateData: updatedTemplateData,
				};
				const pushedItem = await updateTemplate(templatePath, updatedTemplate);

				// Update all section entries with the new template data
				for (const mod of this.modifiedFiles.values()) {
					if (mod.itemType === 'template-section' && mod.gtmItem.path === templatePath) {
						const entry = this.lookupAsFile(mod.uri);
						entry.gtmItem = pushedItem;
					}
				}
				success++;
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				console.error(`Failed to push template ${template.name}: ${errorMessage}`);
				errors.push({ fileName: template.name, error: errorMessage });
				failed++;
			}
		}

		// Push tag and variable changes
		for (const modified of this.modifiedFiles.values()) {
			if (modified.itemType === 'template-section') {
				continue; // Already handled above
			}

			try {
				// Tags and variables use parameter-based code storage
				let updatedItem = updateCode(modified.gtmItem as GtmTag | GtmVariable, modified.newCode);
				if (modified.newName) {
					updatedItem = { ...updatedItem, name: modified.newName };
				}

				let pushedItem: GtmTag | GtmVariable;
				if (modified.itemType === 'tag') {
					pushedItem = await updateTag(modified.gtmItem.path, updatedItem as GtmTag);
				} else {
					pushedItem = await updateVariable(modified.gtmItem.path, updatedItem as GtmVariable);
				}

				// Update the stored gtmItem with the response from GTM
				const entry = this.lookupAsFile(modified.uri);
				entry.gtmItem = pushedItem;

				success++;
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				console.error(`Failed to push ${modified.fileName}: ${errorMessage}`);
				errors.push({ fileName: modified.fileName, error: errorMessage });
				failed++;
			}
		}

		// Clear modified files on success
		if (failed === 0) {
			this.modifiedFiles.clear();
			this._onDidChangeModified.fire();
		}

		return { success, failed, errors };
	}

	discardChanges(uri?: vscode.Uri): void {
		if (uri) {
			const modified = this.modifiedFiles.get(uri.toString());
			if (modified) {
				// Restore original content and name
				const entry = this.lookupAsFile(uri);
				const originalCode = this.extractItemCode(entry.gtmItem, entry.itemType, entry.sectionName);
				entry.data = new TextEncoder().encode(originalCode);
				entry.mtime = Date.now();

				// If it was renamed, restore the original name
				if (modified.newName) {
					this.restoreOriginalName(uri, modified);
				} else {
					this.modifiedFiles.delete(uri.toString());
					this._emitter.fire([{ type: vscode.FileChangeType.Changed, uri }]);
				}
			}
		} else {
			// Discard all changes
			for (const modified of this.modifiedFiles.values()) {
				const entry = this.lookupAsFile(modified.uri);
				const originalCode = this.extractItemCode(entry.gtmItem, entry.itemType, entry.sectionName);
				entry.data = new TextEncoder().encode(originalCode);
				entry.mtime = Date.now();

				// If it was renamed, restore the original name
				if (modified.newName) {
					this.restoreOriginalName(modified.uri, modified);
				} else {
					this._emitter.fire([{ type: vscode.FileChangeType.Changed, uri: modified.uri }]);
				}
			}
			this.modifiedFiles.clear();
		}
		this._onDidChangeModified.fire();
	}

	private restoreOriginalName(uri: vscode.Uri, modified: ModifiedFile): void {
		const parts = uri.path.split('/').filter(p => p);
		const containerName = decodeURIComponent(parts[0]);
		const folder = parts[1] as 'tags' | 'variables';

		const containerDir = this.root.entries.get(containerName);
		if (!containerDir || containerDir.type !== 'directory') {
			return;
		}
		const folderDir = containerDir.entries.get(folder);
		if (!folderDir || folderDir.type !== 'directory') {
			return;
		}

		// Get the current entry
		const entry = folderDir.entries.get(modified.fileName);
		if (!entry || entry.type !== 'file') {
			return;
		}

		// Remove current entry
		folderDir.entries.delete(modified.fileName);

		// Restore original file name
		const originalName = modified.gtmItem.name;
		const originalFileName = this.sanitizeFileName(originalName) + '.js';
		entry.name = originalFileName;
		folderDir.entries.set(originalFileName, entry);

		// Update variable names cache if needed
		if (modified.itemType === 'variable' && modified.newName) {
			const names = this.variableNames.get(containerName) || [];
			const idx = names.indexOf(modified.newName);
			if (idx !== -1) {
				names[idx] = originalName;
			}
			this.variableNames.set(containerName, names);
		}

		const originalUri = vscode.Uri.from({ scheme: 'gtmsense', path: `/${containerName}/${folder}/${originalFileName}` });

		// Remove from modified files
		this.modifiedFiles.delete(uri.toString());

		// Fire change events
		this._emitter.fire([
			{ type: vscode.FileChangeType.Deleted, uri },
			{ type: vscode.FileChangeType.Created, uri: originalUri }
		]);
	}

	renameFile(uri: vscode.Uri, newName: string): vscode.Uri {
		const entry = this.lookupAsFile(uri);
		const parts = uri.path.split('/').filter(p => p);
		const containerName = decodeURIComponent(parts[0]);
		const folder = parts[1] as 'tags' | 'variables';

		console.log(`Renaming file: ${entry.name} -> ${newName} in ${containerName}/${folder}`);

		// Get the directory containing this file
		const containerDir = this.root.entries.get(containerName);
		if (!containerDir || containerDir.type !== 'directory') {
			throw new Error(`Container ${containerName} not found`);
		}
		const folderDir = containerDir.entries.get(folder);
		if (!folderDir || folderDir.type !== 'directory') {
			throw new Error(`Folder ${folder} not found`);
		}

		console.log(`Before rename - folder entries: ${Array.from(folderDir.entries.keys()).join(', ')}`);

		// Remove old entry from directory
		folderDir.entries.delete(entry.name);

		// Check if there's an existing modification for this file
		const existingModified = this.modifiedFiles.get(uri.toString());
		const currentCode = new TextDecoder().decode(entry.data);

		// Update variable names cache if it was a variable
		if (entry.itemType === 'variable') {
			const names = this.variableNames.get(containerName) || [];
			const oldName = (entry.gtmItem as GtmVariable).name;
			const idx = names.indexOf(oldName);
			if (idx !== -1) {
				names[idx] = newName;
			}
			this.variableNames.set(containerName, names);
		}

		// Create new file entry with updated display name
		const newFileName = this.sanitizeFileName(newName) + '.js';
		const newEntry: FileEntry = {
			type: 'file',
			name: newFileName,
			data: entry.data,
			ctime: entry.ctime,
			mtime: Date.now(),
			gtmItem: entry.gtmItem, // Keep original gtmItem - will be updated on push
			itemType: entry.itemType,
		};
		folderDir.entries.set(newFileName, newEntry);

		console.log(`After rename - folder entries: ${Array.from(folderDir.entries.keys()).join(', ')}`);

		const newUri = vscode.Uri.from({ scheme: 'gtmsense', path: `/${containerName}/${folder}/${newFileName}` });

		// Remove old modified entry if exists
		this.modifiedFiles.delete(uri.toString());

		// Track as modified with new name (and preserve any code changes)
		this.modifiedFiles.set(newUri.toString(), {
			uri: newUri,
			containerName,
			folder,
			fileName: newFileName,
			itemType: entry.itemType,
			gtmItem: entry.gtmItem,
			newCode: existingModified?.newCode ?? currentCode,
			newName: newName,
		});

		// Fire change events
		this._emitter.fire([
			{ type: vscode.FileChangeType.Deleted, uri },
			{ type: vscode.FileChangeType.Created, uri: newUri }
		]);
		this._onDidChangeModified.fire();

		return newUri;
	}
}
