import * as vscode from 'vscode';
import {
	GTM_SANDBOX_APIS,
	GTM_SERVER_APIS,
	GTM_SANDBOX_OBJECTS,
	GTM_SERVER_OBJECTS,
	REQUIRE_BASED_APIS,
	REQUIRE_BASED_SERVER_APIS,
	GtmApiDefinition
} from './gtmSandboxApis';

type TemplateType = 'web' | 'server';

/**
 * Provides IntelliSense completions for GTM Sandboxed JavaScript APIs in template files.
 */
export class GtmTemplateCompletionProvider implements vscode.CompletionItemProvider {

	/**
	 * Determines template type based on the file path/section name.
	 * SANDBOXED_JS_FOR_WEB_TEMPLATE -> web
	 * SANDBOXED_JS_FOR_SERVER -> server
	 */
	private getTemplateType(document: vscode.TextDocument): TemplateType {
		const path = document.uri.path;
		if (path.includes('SANDBOXED_JS_FOR_SERVER')) {
			return 'server';
		}
		return 'web'; // Default to web
	}

	/**
	 * Gets all APIs available for the given template type.
	 */
	private getAvailableApis(templateType: TemplateType): GtmApiDefinition[] {
		const allApis = [...GTM_SANDBOX_APIS];

		if (templateType === 'server') {
			// Add server-only APIs, filter out web-only APIs
			return [
				...allApis.filter(api => !api.webOnly),
				...GTM_SERVER_APIS
			];
		} else {
			// Filter out server-only APIs
			return allApis.filter(api => !api.serverOnly);
		}
	}

	/**
	 * Gets all object APIs available for the given template type.
	 */
	private getAvailableObjects(templateType: TemplateType): Record<string, { description: string; methods: { name: string; description: string; signature: string; snippet: string }[] }> {
		if (templateType === 'server') {
			return { ...GTM_SANDBOX_OBJECTS, ...GTM_SERVER_OBJECTS };
		}
		return GTM_SANDBOX_OBJECTS;
	}

	/**
	 * Gets the require-based API list for the template type.
	 */
	private getRequireBasedApis(templateType: TemplateType): string[] {
		return templateType === 'server' ? REQUIRE_BASED_SERVER_APIS : REQUIRE_BASED_APIS;
	}

	provideCompletionItems(
		document: vscode.TextDocument,
		position: vscode.Position,
		_token: vscode.CancellationToken,
		_context: vscode.CompletionContext
	): vscode.CompletionItem[] {
		const templateType = this.getTemplateType(document);
		const linePrefix = document.lineAt(position).text.substring(0, position.character);

		// Check if we're completing inside require('')
		const requireMatch = linePrefix.match(/require\s*\(\s*['"]([^'"]*)?$/);
		if (requireMatch) {
			return this.provideRequireCompletions(templateType, requireMatch[1] || '');
		}

		// Check if we're completing an object method (e.g., JSON., Math., Firestore.)
		const objectMethodMatch = linePrefix.match(/(\w+)\.\s*$/);
		if (objectMethodMatch) {
			const objectName = objectMethodMatch[1];
			return this.provideObjectMethodCompletions(templateType, objectName);
		}

		// Check if we're at the start of a line or after common statement starters
		const isStatementContext = /^\s*$|[;{}()\[\],]\s*$|^\s*(const|let|var|if|else|return|for|while)\s+/.test(linePrefix);

		// Provide API completions (functions that have been required)
		const items: vscode.CompletionItem[] = [];

		// Get existing requires in the document
		const documentText = document.getText();
		const existingRequires = this.findExistingRequires(documentText);

		// Add completions for already-required APIs
		const apis = this.getAvailableApis(templateType);
		for (const api of apis) {
			// Skip test APIs unless in a test section
			if (api.isTestApi && !document.uri.path.includes('TESTS')) {
				continue;
			}

			// Only show if already required or if it's a global (like data)
			const varName = this.getVariableName(api.name);
			if (existingRequires.has(varName) || existingRequires.has(api.name)) {
				const item = this.createApiCompletionItem(api, templateType);
				items.push(item);
			}
		}

		// Add object completions (JSON, Math, etc.)
		const objects = this.getAvailableObjects(templateType);
		for (const [objectName] of Object.entries(objects)) {
			const varName = this.getVariableName(objectName);
			if (existingRequires.has(varName) || existingRequires.has(objectName)) {
				const item = new vscode.CompletionItem(objectName, vscode.CompletionItemKind.Module);
				item.detail = `GTM ${templateType === 'server' ? 'Server' : 'Web'} API`;
				items.push(item);
			}
		}

		// If in a statement context, also suggest require() for new APIs
		if (isStatementContext) {
			const requireItem = new vscode.CompletionItem('require', vscode.CompletionItemKind.Function);
			requireItem.detail = 'Import a GTM Sandboxed API';
			requireItem.insertText = new vscode.SnippetString("const ${1:apiName} = require('${2:apiName}');");
			requireItem.documentation = new vscode.MarkdownString('Import a built-in GTM API function. Use `require(\'apiName\')` to import APIs.');
			items.push(requireItem);
		}

		// Add data object completion (always available as a global)
		const dataItem = new vscode.CompletionItem('data', vscode.CompletionItemKind.Variable);
		dataItem.detail = 'Template input data';
		dataItem.documentation = new vscode.MarkdownString('The data object containing values from template fields defined in TEMPLATE_PARAMETERS.');
		items.push(dataItem);

		return items;
	}

	private provideRequireCompletions(templateType: TemplateType, prefix: string): vscode.CompletionItem[] {
		const items: vscode.CompletionItem[] = [];
		const requireApis = this.getRequireBasedApis(templateType);

		for (const apiName of requireApis) {
			if (prefix && !apiName.toLowerCase().startsWith(prefix.toLowerCase())) {
				continue;
			}

			const item = new vscode.CompletionItem(apiName, vscode.CompletionItemKind.Module);
			item.insertText = apiName;

			// Find the API definition for documentation
			const allApis = [...GTM_SANDBOX_APIS, ...GTM_SERVER_APIS];
			const apiDef = allApis.find(a => a.name === apiName);
			const objectDef = { ...GTM_SANDBOX_OBJECTS, ...GTM_SERVER_OBJECTS }[apiName];

			if (apiDef) {
				item.detail = apiDef.returnType;
				item.documentation = new vscode.MarkdownString(apiDef.description);
				if (apiDef.deprecated) {
					item.tags = [vscode.CompletionItemTag.Deprecated];
					item.documentation.appendMarkdown(`\n\n⚠️ **Deprecated**: ${apiDef.deprecatedMessage || 'This API is deprecated.'}`);
				}
				if (apiDef.serverOnly) {
					item.documentation.appendMarkdown('\n\n🖥️ *Server-side only*');
				}
				if (apiDef.webOnly) {
					item.documentation.appendMarkdown('\n\n🌐 *Web template only*');
				}
			} else if (objectDef) {
				item.detail = 'Object API';
				item.documentation = new vscode.MarkdownString(objectDef.description);
				item.documentation.appendMarkdown('\n\n**Methods:**\n');
				for (const method of objectDef.methods) {
					item.documentation.appendMarkdown(`- \`${method.name}\`: ${method.description}\n`);
				}
			}

			items.push(item);
		}

		return items;
	}

	private provideObjectMethodCompletions(templateType: TemplateType, objectName: string): vscode.CompletionItem[] {
		const items: vscode.CompletionItem[] = [];
		const objects = this.getAvailableObjects(templateType);
		const objectDef = objects[objectName];

		if (objectDef) {
			for (const method of objectDef.methods) {
				const item = new vscode.CompletionItem(method.name, vscode.CompletionItemKind.Method);
				item.detail = method.signature;
				item.documentation = new vscode.MarkdownString(method.description);

				// Extract snippet without the object prefix
				const snippetWithoutPrefix = method.snippet.replace(`${objectName}.`, '');
				item.insertText = new vscode.SnippetString(snippetWithoutPrefix);

				items.push(item);
			}
		}

		return items;
	}

	private createApiCompletionItem(api: GtmApiDefinition, templateType: TemplateType): vscode.CompletionItem {
		const item = new vscode.CompletionItem(api.name, vscode.CompletionItemKind.Function);
		item.detail = `(${api.parameters.map(p => `${p.name}${p.optional ? '?' : ''}: ${p.type}`).join(', ')}) => ${api.returnType}`;

		const doc = new vscode.MarkdownString(api.description);

		if (api.parameters.length > 0) {
			doc.appendMarkdown('\n\n**Parameters:**\n');
			for (const param of api.parameters) {
				doc.appendMarkdown(`- \`${param.name}\`${param.optional ? ' (optional)' : ''}: ${param.type}`);
				if (param.description) {
					doc.appendMarkdown(` - ${param.description}`);
				}
				doc.appendMarkdown('\n');
			}
		}

		doc.appendMarkdown(`\n**Returns:** \`${api.returnType}\``);

		if (api.deprecated) {
			item.tags = [vscode.CompletionItemTag.Deprecated];
			doc.appendMarkdown(`\n\n⚠️ **Deprecated**: ${api.deprecatedMessage || 'This API is deprecated.'}`);
		}

		if (api.serverOnly) {
			doc.appendMarkdown('\n\n🖥️ *Server-side only*');
		}
		if (api.webOnly) {
			doc.appendMarkdown('\n\n🌐 *Web template only*');
		}

		item.documentation = doc;

		// Use snippet for insertText if available
		if (api.snippet) {
			item.insertText = new vscode.SnippetString(api.snippet);
		}

		return item;
	}

	private findExistingRequires(text: string): Set<string> {
		const requires = new Set<string>();

		// Match patterns like: const apiName = require('apiName')
		// or: const JSON = require('JSON')
		const requireRegex = /(?:const|let|var)\s+(\w+)\s*=\s*require\s*\(\s*['"](\w+)['"]\s*\)/g;
		let match;
		while ((match = requireRegex.exec(text)) !== null) {
			requires.add(match[1]); // Variable name
			requires.add(match[2]); // API name
		}

		return requires;
	}

	private getVariableName(apiName: string): string {
		// Most APIs use the same name for variable and require
		// But some like JSON, Math are typically used as-is
		return apiName;
	}
}

/**
 * Provides hover documentation for GTM Sandboxed JavaScript APIs.
 */
export class GtmTemplateHoverProvider implements vscode.HoverProvider {

	private getTemplateType(document: vscode.TextDocument): TemplateType {
		const path = document.uri.path;
		if (path.includes('SANDBOXED_JS_FOR_SERVER')) {
			return 'server';
		}
		return 'web';
	}

	provideHover(
		document: vscode.TextDocument,
		position: vscode.Position,
		_token: vscode.CancellationToken
	): vscode.Hover | null {
		const templateType = this.getTemplateType(document);
		const wordRange = document.getWordRangeAtPosition(position);
		if (!wordRange) {
			return null;
		}

		const word = document.getText(wordRange);

		// Check if it's an API name
		const allApis = [...GTM_SANDBOX_APIS, ...GTM_SERVER_APIS];
		const api = allApis.find(a => a.name === word);

		if (api) {
			// Check if this API is available for this template type
			if (api.serverOnly && templateType !== 'server') {
				return null;
			}
			if (api.webOnly && templateType !== 'web') {
				return null;
			}

			return new vscode.Hover(this.createApiDocumentation(api, templateType));
		}

		// Check if it's an object name
		const allObjects = { ...GTM_SANDBOX_OBJECTS, ...GTM_SERVER_OBJECTS };
		const objectDef = allObjects[word];

		if (objectDef) {
			return new vscode.Hover(this.createObjectDocumentation(word, objectDef, templateType));
		}

		// Check for 'data' object
		if (word === 'data') {
			const md = new vscode.MarkdownString();
			md.appendMarkdown('### data\n\n');
			md.appendMarkdown('The template input data object.\n\n');
			md.appendMarkdown('Contains values from template fields defined in the `TEMPLATE_PARAMETERS` section.\n\n');
			md.appendMarkdown('Access field values using `data.fieldName` or `data[\'fieldName\']`.');
			return new vscode.Hover(md);
		}

		return null;
	}

	private createApiDocumentation(api: GtmApiDefinition, templateType: TemplateType): vscode.MarkdownString {
		const md = new vscode.MarkdownString();

		// Function signature
		const params = api.parameters.map(p => `${p.name}${p.optional ? '?' : ''}: ${p.type}`).join(', ');
		md.appendCodeblock(`function ${api.name}(${params}): ${api.returnType}`, 'typescript');

		md.appendMarkdown('\n' + api.description + '\n');

		if (api.parameters.length > 0) {
			md.appendMarkdown('\n**Parameters:**\n');
			for (const param of api.parameters) {
				md.appendMarkdown(`- \`${param.name}\`${param.optional ? ' (optional)' : ''}: ${param.type}`);
				if (param.description) {
					md.appendMarkdown(` — ${param.description}`);
				}
				md.appendMarkdown('\n');
			}
		}

		md.appendMarkdown(`\n**Returns:** \`${api.returnType}\`\n`);

		if (api.deprecated) {
			md.appendMarkdown(`\n⚠️ **Deprecated**: ${api.deprecatedMessage || 'This API is deprecated.'}\n`);
		}

		if (api.serverOnly) {
			md.appendMarkdown('\n🖥️ *Server-side template only*\n');
		}
		if (api.webOnly) {
			md.appendMarkdown('\n🌐 *Web template only*\n');
		}

		// Add usage example
		if (api.snippet) {
			md.appendMarkdown('\n**Example:**\n');
			// Clean up snippet placeholders for display
			const example = api.snippet.replace(/\$\{?\d+:?([^}]*)\}?/g, '$1').replace(/\$0/g, '');
			md.appendCodeblock(example, 'javascript');
		}

		// Add require hint
		md.appendMarkdown(`\n*Import with:* \`const ${api.name} = require('${api.name}');\``);

		return md;
	}

	private createObjectDocumentation(
		name: string,
		objectDef: { description: string; methods: { name: string; description: string; signature: string; snippet: string }[] },
		templateType: TemplateType
	): vscode.MarkdownString {
		const md = new vscode.MarkdownString();

		md.appendMarkdown(`### ${name}\n\n`);
		md.appendMarkdown(objectDef.description + '\n\n');

		md.appendMarkdown('**Methods:**\n\n');
		for (const method of objectDef.methods) {
			md.appendMarkdown(`#### ${name}.${method.name}\n`);
			md.appendCodeblock(`${method.signature}`, 'typescript');
			md.appendMarkdown(method.description + '\n\n');
		}

		md.appendMarkdown(`\n*Import with:* \`const ${name} = require('${name}');\``);

		return md;
	}
}
