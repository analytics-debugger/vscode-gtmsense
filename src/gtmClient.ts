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
