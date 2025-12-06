import { getAccessToken } from './auth';

const GTM_API_BASE = 'https://tagmanager.googleapis.com/tagmanager/v2';

export interface GtmTag {
	tagId: string;
	name: string;
	type: string;
	parameter?: Array<{
		type: string;
		key: string;
		value?: string;
	}>;
	fingerprint: string;
	path: string;
}

export interface GtmVariable {
	variableId: string;
	name: string;
	type: string;
	parameter?: Array<{
		type: string;
		key: string;
		value?: string;
	}>;
	fingerprint: string;
	path: string;
}

export interface GtmContainer {
	containerId: string;
	publicId: string; // GTM-XXXXXX
	name: string;
	path: string;
	usageContext: string[]; // e.g., ['web'] or ['server']
}

// Format container type for display
export function formatContainerType(usageContext: string[] | undefined): string {
	if (!usageContext || usageContext.length === 0) {
		return 'Unknown';
	}
	// Map usage context values to readable labels
	return usageContext.map(ctx => {
		switch (ctx.toLowerCase()) {
			case 'web': return 'Web';
			case 'server': return 'Server';
			case 'android': return 'Android';
			case 'ios': return 'iOS';
			default: return ctx;
		}
	}).join(', ');
}

// Get icon for container type (VS Code codicon)
export function getContainerTypeIcon(usageContext: string[] | undefined): string {
	if (!usageContext || usageContext.length === 0) {
		return '$(question)';
	}
	const ctx = usageContext[0]?.toLowerCase();
	switch (ctx) {
		case 'web': return '$(globe)';
		case 'server': return '$(server)';
		case 'android': return '$(device-mobile)';
		case 'ios': return '$(device-mobile)';
		default: return '$(package)';
	}
}

export interface GtmWorkspace {
	workspaceId: string;
	name: string;
	path: string;
}

export interface GtmAccount {
	accountId: string;
	name: string;
	path: string;
}

export interface GtmTemplate {
	templateId: string;
	name: string;
	fingerprint: string;
	path: string;
	templateData: string;
}

async function gtmFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
	const token = await getAccessToken();
	const response = await fetch(`${GTM_API_BASE}${endpoint}`, {
		...options,
		headers: {
			'Authorization': `Bearer ${token}`,
			'Content-Type': 'application/json',
			...options.headers,
		},
	});

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`GTM API error: ${response.status} - ${error}`);
	}

	return response.json() as Promise<T>;
}

export async function listAccounts(): Promise<GtmAccount[]> {
	const result = await gtmFetch<{ account: GtmAccount[] }>('/accounts');
	return result.account || [];
}

export async function listContainers(accountPath: string): Promise<GtmContainer[]> {
	const result = await gtmFetch<{ container: GtmContainer[] }>(`/${accountPath}/containers`);
	
	return result.container || [];
}

export async function listWorkspaces(containerPath: string): Promise<GtmWorkspace[]> {
	const result = await gtmFetch<{ workspace: GtmWorkspace[] }>(`/${containerPath}/workspaces`);
	return result.workspace || [];
}

export async function listTags(workspacePath: string): Promise<GtmTag[]> {
	const result = await gtmFetch<{ tag: GtmTag[] }>(`/${workspacePath}/tags`);
	return result.tag || [];
}

export async function listVariables(workspacePath: string): Promise<GtmVariable[]> {
	const result = await gtmFetch<{ variable: GtmVariable[] }>(`/${workspacePath}/variables`);
	return result.variable || [];
}

export async function listTemplates(workspacePath: string): Promise<GtmTemplate[]> {
	const result = await gtmFetch<{ template: GtmTemplate[] }>(`/${workspacePath}/templates`);
	return result.template || [];
}

export async function updateTag(tagPath: string, tag: Partial<GtmTag>): Promise<GtmTag> {
	return gtmFetch<GtmTag>(`/${tagPath}`, {
		method: 'PUT',
		body: JSON.stringify(tag),
	});
}

export async function updateVariable(variablePath: string, variable: Partial<GtmVariable>): Promise<GtmVariable> {
	return gtmFetch<GtmVariable>(`/${variablePath}`, {
		method: 'PUT',
		body: JSON.stringify(variable),
	});
}

export async function updateTemplate(templatePath: string, template: Partial<GtmTemplate>): Promise<GtmTemplate> {
	return gtmFetch<GtmTemplate>(`/${templatePath}`, {
		method: 'PUT',
		body: JSON.stringify(template),
	});
}

export async function createWorkspace(containerPath: string, name: string): Promise<GtmWorkspace> {
	return gtmFetch<GtmWorkspace>(`/${containerPath}/workspaces`, {
		method: 'POST',
		body: JSON.stringify({ name }),
	});
}

export async function createTag(workspacePath: string, name: string, html: string): Promise<GtmTag> {
	return gtmFetch<GtmTag>(`/${workspacePath}/tags`, {
		method: 'POST',
		body: JSON.stringify({
			name,
			type: 'html',
			parameter: [
				{ type: 'template', key: 'html', value: html },
				{ type: 'boolean', key: 'supportDocumentWrite', value: 'false' },
			],
		}),
	});
}

export async function createVariable(workspacePath: string, name: string, javascript: string): Promise<GtmVariable> {
	return gtmFetch<GtmVariable>(`/${workspacePath}/variables`, {
		method: 'POST',
		body: JSON.stringify({
			name,
			type: 'jsm',
			parameter: [
				{ type: 'template', key: 'javascript', value: javascript },
			],
		}),
	});
}

export async function createTemplate(workspacePath: string, name: string, templateType: 'web' | 'server'): Promise<GtmTemplate> {
	const jsSection = templateType === 'web' ? '___SANDBOXED_JS_FOR_WEB_TEMPLATE___' : '___SANDBOXED_JS_FOR_SERVER___';
	const defaultTemplateData = `___INFO___

{
  "type": "TAG",
  "id": "cvt_temp_public_id",
  "version": 1,
  "securityGroups": [],
  "displayName": "${name}",
  "brand": {},
  "description": "",
  "containerContexts": [
    "${templateType === 'web' ? 'WEB' : 'SERVER'}"
  ]
}


___TEMPLATE_PARAMETERS___

[]


${jsSection}

// Enter your template code here


___WEB_PERMISSIONS___

[]


___TESTS___

scenarios: []
`;

	return gtmFetch<GtmTemplate>(`/${workspacePath}/templates`, {
		method: 'POST',
		body: JSON.stringify({
			name,
			templateData: defaultTemplateData,
		}),
	});
}

export async function deleteTag(tagPath: string): Promise<void> {
	await gtmFetch<void>(`/${tagPath}`, {
		method: 'DELETE',
	});
}

export async function deleteVariable(variablePath: string): Promise<void> {
	await gtmFetch<void>(`/${variablePath}`, {
		method: 'DELETE',
	});
}

// Extract JavaScript code from tag/variable parameters
export function extractCode(item: GtmTag | GtmVariable): string {
	if (!item.parameter) {
		return '';
	}

	// Custom HTML tags have 'html' parameter
	const htmlParam = item.parameter.find(p => p.key === 'html');
	if (htmlParam?.value) {
		return htmlParam.value;
	}

	// Custom JavaScript variables have 'javascript' parameter
	const jsParam = item.parameter.find(p => p.key === 'javascript');
	if (jsParam?.value) {
		return jsParam.value;
	}

	return '';
}

// Update the code in a tag/variable's parameters
export function updateCode(item: GtmTag | GtmVariable, newCode: string): GtmTag | GtmVariable {
	if (!item.parameter) {
		return item;
	}

	const updated = { ...item, parameter: [...item.parameter] };

	const htmlIndex = updated.parameter.findIndex(p => p.key === 'html');
	if (htmlIndex !== -1) {
		updated.parameter[htmlIndex] = { ...updated.parameter[htmlIndex], value: newCode };
		return updated;
	}

	const jsIndex = updated.parameter.findIndex(p => p.key === 'javascript');
	if (jsIndex !== -1) {
		updated.parameter[jsIndex] = { ...updated.parameter[jsIndex], value: newCode };
		return updated;
	}

	return updated;
}

// Template section interface
export interface TemplateSection {
	name: string;       // Section name without underscores (e.g., "INFO", "SANDBOXED_JS_FOR_WEB_TEMPLATE")
	marker: string;     // Full marker (e.g., "___INFO___")
	content: string;    // Section content
	extension: string;  // File extension for this section
}

// Map section names to file extensions
function getSectionExtension(sectionName: string): string {
	if (sectionName.includes('SANDBOXED_JS')) {
		return '.js';
	}
	if (sectionName === 'INFO' || sectionName === 'TEMPLATE_PARAMETERS' ||
		sectionName.includes('PERMISSIONS')) {
		return '.json';
	}
	if (sectionName === 'TESTS') {
		return '.json';
	}
	return '.txt';
}

// Parse a GTM template into its sections
export function parseTemplateSections(templateData: string): TemplateSection[] {
	const sections: TemplateSection[] = [];
	const sectionRegex = /___([A-Z_]+)___/g;
	const matches: Array<{ name: string; marker: string; index: number }> = [];

	let match;
	while ((match = sectionRegex.exec(templateData)) !== null) {
		matches.push({
			name: match[1],
			marker: match[0],
			index: match.index,
		});
	}

	for (let i = 0; i < matches.length; i++) {
		const current = matches[i];
		const contentStart = current.index + current.marker.length;
		const contentEnd = i < matches.length - 1 ? matches[i + 1].index : templateData.length;
		const content = templateData.substring(contentStart, contentEnd).trim();

		sections.push({
			name: current.name,
			marker: current.marker,
			content,
			extension: getSectionExtension(current.name),
		});
	}

	return sections;
}

// Rebuild template from sections
export function rebuildTemplate(sections: TemplateSection[]): string {
	return sections.map(s => s.marker + '\n' + s.content + '\n').join('\n');
}

// Update a specific section in the template
export function updateTemplateSection(templateData: string, sectionName: string, newContent: string): string {
	const sections = parseTemplateSections(templateData);
	const sectionIndex = sections.findIndex(s => s.name === sectionName);

	if (sectionIndex === -1) {
		return templateData;
	}

	sections[sectionIndex].content = newContent;
	return rebuildTemplate(sections);
}

// Get the template type based on the JS section marker
export function getTemplateType(templateData: string): 'web' | 'server' | 'unknown' {
	if (templateData.includes('___SANDBOXED_JS_FOR_WEB_TEMPLATE___')) {
		return 'web';
	}
	if (templateData.includes('___SANDBOXED_JS_FOR_SERVER___')) {
		return 'server';
	}
	return 'unknown';
}
