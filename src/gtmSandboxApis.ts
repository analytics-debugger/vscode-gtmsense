/**
 * GTM Sandboxed JavaScript API definitions for IntelliSense
 * Web: https://developers.google.com/tag-platform/tag-manager/templates/api
 * Server: https://developers.google.com/tag-platform/tag-manager/server-side/api
 */

export interface GtmApiParameter {
	name: string;
	type: string;
	optional?: boolean;
	description?: string;
}

export interface GtmApiDefinition {
	name: string;
	description: string;
	parameters: GtmApiParameter[];
	returnType: string;
	snippet?: string; // VS Code snippet format
	isTestApi?: boolean;
	deprecated?: boolean;
	deprecatedMessage?: string;
	serverOnly?: boolean; // Server-side template only
	webOnly?: boolean; // Web template only
}

export const GTM_SANDBOX_APIS: GtmApiDefinition[] = [
	// Core APIs
	{
		name: 'addConsentListener',
		description: 'Registers a listener function that executes when a consent type state changes from denied to granted or vice versa.',
		parameters: [
			{ name: 'consentType', type: 'string', description: 'The consent type to monitor' },
			{ name: 'listener', type: '(consentType: string, granted: boolean) => void', description: 'Callback receiving (consentType, granted) where granted is boolean' }
		],
		returnType: 'void',
		snippet: "addConsentListener('${1:consentType}', (consentType, granted) => {\n\t$0\n});"
	},
	{
		name: 'addEventCallback',
		description: 'Registers a callback invoked at event completion after all tags execute or timeout occurs.',
		parameters: [
			{ name: 'callback', type: '(ctid: string, eventData: object) => void', description: 'Receives (ctid, eventData) with tag execution details' }
		],
		returnType: 'void',
		snippet: "addEventCallback((ctid, eventData) => {\n\t$0\n});"
	},
	{
		name: 'aliasInWindow',
		description: 'Creates a window object alias by copying a value from one path to another.',
		parameters: [
			{ name: 'toPath', type: 'string', description: 'Destination path (dot-separated)' },
			{ name: 'fromPath', type: 'string', description: 'Source path (dot-separated)' }
		],
		returnType: 'boolean',
		snippet: "aliasInWindow('${1:toPath}', '${2:fromPath}')",
		webOnly: true
	},
	{
		name: 'callInWindow',
		description: 'Calls functions from the window object in a policy-controlled manner. Returns undefined if the return type is unsupported.',
		parameters: [
			{ name: 'pathToFunction', type: 'string', description: 'Dot-separated function path' },
			{ name: '...args', type: 'any[]', description: 'Function arguments' }
		],
		returnType: 'any',
		snippet: "callInWindow('${1:pathToFunction}'$0)",
		webOnly: true
	},
	{
		name: 'callLater',
		description: 'Schedules asynchronous function execution after current code returns (setTimeout equivalent).',
		parameters: [
			{ name: 'function', type: '() => void', description: 'Function to call asynchronously' }
		],
		returnType: 'void',
		snippet: "callLater(() => {\n\t$0\n});"
	},
	{
		name: 'copyFromDataLayer',
		description: 'Retrieves a value from the data layer by key.',
		parameters: [
			{ name: 'key', type: 'string', description: 'Data layer key (dot-notation format)' },
			{ name: 'dataLayerVersion', type: 'number', optional: true, description: 'Data layer version (default: 2)' }
		],
		returnType: 'any',
		snippet: "copyFromDataLayer('${1:key}')",
		webOnly: true
	},
	{
		name: 'copyFromWindow',
		description: 'Retrieves a variable from the window object with type coercion to supported types.',
		parameters: [
			{ name: 'key', type: 'string', description: 'Window property name' }
		],
		returnType: 'any',
		snippet: "copyFromWindow('${1:key}')",
		webOnly: true
	},
	{
		name: 'createArgumentsQueue',
		description: 'Creates a function that pushes its arguments onto a window array.',
		parameters: [
			{ name: 'fnKey', type: 'string', description: 'Window path for created function' },
			{ name: 'arrayKey', type: 'string', description: 'Window path for array storage' }
		],
		returnType: 'function',
		snippet: "createArgumentsQueue('${1:fnKey}', '${2:arrayKey}')",
		webOnly: true
	},
	{
		name: 'createQueue',
		description: 'Creates an array in window and returns a function that pushes values to it.',
		parameters: [
			{ name: 'arrayKey', type: 'string', description: 'Window path for array creation' }
		],
		returnType: 'function',
		snippet: "createQueue('${1:arrayKey}')",
		webOnly: true
	},
	{
		name: 'decodeUri',
		description: 'Decodes URI-encoded characters in a string.',
		parameters: [
			{ name: 'encoded_uri', type: 'string', description: 'URI to decode' }
		],
		returnType: 'string|undefined',
		snippet: "decodeUri('${1:encoded_uri}')"
	},
	{
		name: 'decodeUriComponent',
		description: 'Decodes URI-component encoded characters in a string.',
		parameters: [
			{ name: 'encoded_uri_component', type: 'string', description: 'URI component to decode' }
		],
		returnType: 'string|undefined',
		snippet: "decodeUriComponent('${1:encoded_uri_component}')"
	},
	{
		name: 'encodeUri',
		description: 'Encodes a complete URI by escaping special characters.',
		parameters: [
			{ name: 'uri', type: 'string', description: 'Complete URI to encode' }
		],
		returnType: 'string|undefined',
		snippet: "encodeUri('${1:uri}')"
	},
	{
		name: 'encodeUriComponent',
		description: 'Encodes URI component by escaping special characters.',
		parameters: [
			{ name: 'str', type: 'string', description: 'URI component to encode' }
		],
		returnType: 'string|undefined',
		snippet: "encodeUriComponent('${1:str}')"
	},
	{
		name: 'fromBase64',
		description: 'Decodes base64-encoded strings.',
		parameters: [
			{ name: 'base64EncodedString', type: 'string', description: 'Base64 string to decode' }
		],
		returnType: 'string|undefined',
		snippet: "fromBase64('${1:base64EncodedString}')"
	},
	{
		name: 'generateRandom',
		description: 'Generates a random integer within specified range.',
		parameters: [
			{ name: 'min', type: 'number', description: 'Minimum value' },
			{ name: 'max', type: 'number', description: 'Maximum value' }
		],
		returnType: 'number',
		snippet: 'generateRandom(${1:min}, ${2:max})'
	},
	{
		name: 'getContainerVersion',
		description: 'Returns object containing container metadata including ID, version, environment, and mode flags.',
		parameters: [],
		returnType: '{ containerId: string, version: string, environmentName: string, environmentMode: boolean, debugMode: boolean, previewMode: boolean }',
		snippet: 'getContainerVersion()'
	},
	{
		name: 'getCookieValues',
		description: 'Retrieves all values for cookies matching a specified name.',
		parameters: [
			{ name: 'name', type: 'string', description: 'Cookie name' },
			{ name: 'decode', type: 'boolean', optional: true, description: 'Whether to decode values (default: true)' }
		],
		returnType: 'string[]',
		snippet: "getCookieValues('${1:name}')"
	},
	{
		name: 'getQueryParameters',
		description: 'Extracts query parameter values from current URL.',
		parameters: [
			{ name: 'queryKey', type: 'string', description: 'Parameter name to retrieve' },
			{ name: 'retrieveAll', type: 'boolean', optional: true, description: 'Return all values or first only' }
		],
		returnType: 'string|string[]',
		snippet: "getQueryParameters('${1:queryKey}')"
	},
	{
		name: 'getReferrerQueryParameters',
		description: 'Extracts query parameter values from referrer URL.',
		parameters: [
			{ name: 'queryKey', type: 'string', description: 'Parameter name' },
			{ name: 'retrieveAll', type: 'boolean', optional: true, description: 'Return all or first value' }
		],
		returnType: 'string|string[]',
		snippet: "getReferrerQueryParameters('${1:queryKey}')"
	},
	{
		name: 'getReferrerUrl',
		description: 'Retrieves full or partial referrer URL components.',
		parameters: [
			{ name: 'component', type: "'protocol'|'host'|'port'|'path'|'query'|'extension'", optional: true, description: 'URL component to retrieve' }
		],
		returnType: 'string',
		snippet: "getReferrerUrl('${1|protocol,host,port,path,query,extension|}')"
	},
	{
		name: 'getTimestamp',
		description: 'Returns the current time in milliseconds since Unix epoch.',
		parameters: [],
		returnType: 'number',
		snippet: 'getTimestamp()',
		deprecated: true,
		deprecatedMessage: 'Use getTimestampMillis() instead'
	},
	{
		name: 'getTimestampMillis',
		description: 'Returns the current time in milliseconds since Unix epoch.',
		parameters: [],
		returnType: 'number',
		snippet: 'getTimestampMillis()'
	},
	{
		name: 'getType',
		description: 'Returns string describing value type, differentiating arrays from objects.',
		parameters: [
			{ name: 'value', type: 'any', description: 'Value to type-check' }
		],
		returnType: "'undefined'|'null'|'boolean'|'number'|'string'|'array'|'object'|'function'",
		snippet: 'getType(${1:value})'
	},
	{
		name: 'getUrl',
		description: 'Retrieves full or partial current URL by component type.',
		parameters: [
			{ name: 'component', type: "'protocol'|'host'|'port'|'path'|'query'|'extension'|'fragment'", optional: true, description: 'URL component to retrieve' }
		],
		returnType: 'string',
		snippet: "getUrl('${1|protocol,host,port,path,query,extension,fragment|}')"
	},
	{
		name: 'gtagSet',
		description: 'Pushes gtag set command to data layer for processing after current event completes.',
		parameters: [
			{ name: 'object', type: 'object', description: 'Properties to update in global state' }
		],
		returnType: 'void',
		snippet: 'gtagSet({ ${1:key}: ${2:value} })'
	},
	{
		name: 'injectHiddenIframe',
		description: 'Adds invisible iframe to page at specified URL.',
		parameters: [
			{ name: 'url', type: 'string', description: 'iframe src attribute value' },
			{ name: 'onSuccess', type: 'function', description: 'Callback on successful load' }
		],
		returnType: 'void',
		snippet: "injectHiddenIframe('${1:url}', () => {\n\t$0\n});",
		webOnly: true
	},
	{
		name: 'injectScript',
		description: 'Asynchronously loads script from URL with optional success/failure callbacks and caching.',
		parameters: [
			{ name: 'url', type: 'string', description: 'Script URL' },
			{ name: 'onSuccess', type: 'function', description: 'Success callback' },
			{ name: 'onFailure', type: 'function', description: 'Failure callback' },
			{ name: 'cacheToken', type: 'string', optional: true, description: 'Cache identifier for deduplication' }
		],
		returnType: 'void',
		snippet: "injectScript('${1:url}', () => {\n\t// onSuccess\n\t$0\n}, () => {\n\t// onFailure\n}, '${2:cacheToken}');",
		webOnly: true
	},
	{
		name: 'isConsentGranted',
		description: 'Checks whether a consent type is granted. Unset types default to granted.',
		parameters: [
			{ name: 'consentType', type: 'string', description: 'Consent type to check' }
		],
		returnType: 'boolean',
		snippet: "isConsentGranted('${1|ad_storage,analytics_storage,functionality_storage,personalization_storage,security_storage|}')"
	},
	{
		name: 'logToConsole',
		description: 'Logs arguments to browser console.',
		parameters: [
			{ name: '...args', type: 'any[]', description: 'Values to log' }
		],
		returnType: 'void',
		snippet: 'logToConsole(${1:message})'
	},
	{
		name: 'makeInteger',
		description: 'Converts value to integer number type.',
		parameters: [
			{ name: 'value', type: 'any', description: 'Value to convert' }
		],
		returnType: 'number',
		snippet: 'makeInteger(${1:value})'
	},
	{
		name: 'makeNumber',
		description: 'Converts value to floating-point number type.',
		parameters: [
			{ name: 'value', type: 'any', description: 'Value to convert' }
		],
		returnType: 'number',
		snippet: 'makeNumber(${1:value})'
	},
	{
		name: 'makeString',
		description: 'Converts value to string type.',
		parameters: [
			{ name: 'value', type: 'any', description: 'Value to convert' }
		],
		returnType: 'string',
		snippet: 'makeString(${1:value})'
	},
	{
		name: 'makeTableMap',
		description: 'Converts two-column table object to key-value map format.',
		parameters: [
			{ name: 'tableObj', type: 'object[]', description: 'List of row objects' },
			{ name: 'keyColumnName', type: 'string', description: 'Column name for map keys' },
			{ name: 'valueColumnName', type: 'string', description: 'Column name for map values' }
		],
		returnType: 'object|null',
		snippet: "makeTableMap(${1:tableObj}, '${2:keyColumn}', '${3:valueColumn}')"
	},
	{
		name: 'parseUrl',
		description: 'Parses URL into component parts including scheme, host, path, query params, and hash.',
		parameters: [
			{ name: 'url', type: 'string', description: 'URL to parse' }
		],
		returnType: '{ href: string, origin: string, protocol: string, username: string, password: string, host: string, hostname: string, port: string, pathname: string, search: string, searchParams: object, hash: string }',
		snippet: "parseUrl('${1:url}')"
	},
	{
		name: 'queryPermission',
		description: 'Queries whether a permission is granted, optionally with function-specific arguments.',
		parameters: [
			{ name: 'permission', type: 'string', description: 'Permission name to check' },
			{ name: '...args', type: 'any[]', optional: true, description: 'Function-specific arguments' }
		],
		returnType: 'boolean',
		snippet: "queryPermission('${1:permission}'$0)"
	},
	{
		name: 'readAnalyticsStorage',
		description: 'Retrieves analytics storage data including client ID and session information.',
		parameters: [
			{ name: 'cookieOptions', type: 'object', optional: true, description: 'Cookie configuration with cookie_prefix, cookie_domain, cookie_path' }
		],
		returnType: '{ client_id: string, sessions: object[] }',
		snippet: 'readAnalyticsStorage()'
	},
	{
		name: 'readCharacterSet',
		description: 'Returns document character set value.',
		parameters: [],
		returnType: 'string',
		snippet: 'readCharacterSet()'
	},
	{
		name: 'readTitle',
		description: 'Returns document title value.',
		parameters: [],
		returnType: 'string',
		snippet: 'readTitle()'
	},
	{
		name: 'sendPixel',
		description: 'Makes GET request to specified URL endpoint with optional callbacks.',
		parameters: [
			{ name: 'url', type: 'string', description: 'Destination URL' },
			{ name: 'onSuccess', type: 'function', optional: true, description: 'Called on successful response' },
			{ name: 'onFailure', type: 'function', optional: true, description: 'Called on failed response' }
		],
		returnType: 'void',
		snippet: "sendPixel('${1:url}', () => {\n\t// onSuccess\n\t$0\n}, () => {\n\t// onFailure\n});",
		webOnly: true
	},
	{
		name: 'setCookie',
		description: 'Sets or deletes cookie with name, value, and optional attributes.',
		parameters: [
			{ name: 'name', type: 'string', description: 'Cookie name' },
			{ name: 'value', type: 'string', description: 'Cookie value' },
			{ name: 'options', type: 'object', optional: true, description: 'Domain, Path, Expires, Max-Age, Secure, SameSite attributes' },
			{ name: 'encode', type: 'boolean', optional: true, description: 'URL-encode value (default: true)' }
		],
		returnType: 'void',
		snippet: "setCookie('${1:name}', '${2:value}', { domain: '${3:auto}', path: '/', 'max-age': ${4:63072000} });",
		webOnly: true
	},
	{
		name: 'setDefaultConsentState',
		description: 'Pushes default consent state to data layer for processing before queued items.',
		parameters: [
			{ name: 'consentSettings', type: 'object', description: "Mapping of consent types to 'granted'/'denied', plus optional region array and wait_for_update milliseconds" }
		],
		returnType: 'void',
		snippet: "setDefaultConsentState({\n\t'ad_storage': '${1|granted,denied|}',\n\t'analytics_storage': '${2|granted,denied|}',\n\twait_for_update: ${3:500}\n});"
	},
	{
		name: 'setInWindow',
		description: 'Sets value in window object at specified key, with override control.',
		parameters: [
			{ name: 'key', type: 'string', description: 'Window property name' },
			{ name: 'value', type: 'any', description: 'Value to set' },
			{ name: 'overrideExisting', type: 'boolean', description: 'Whether to override existing values' }
		],
		returnType: 'boolean',
		snippet: "setInWindow('${1:key}', ${2:value}, ${3|true,false|})",
		webOnly: true
	},
	{
		name: 'sha256',
		description: 'Calculates SHA-256 digest with callback returning base64 or hex encoding.',
		parameters: [
			{ name: 'input', type: 'string', description: 'String to hash' },
			{ name: 'onSuccess', type: 'function', description: 'Callback receiving digest' },
			{ name: 'onFailure', type: 'function', optional: true, description: 'Error callback' },
			{ name: 'options', type: 'object', optional: true, description: "outputEncoding as 'base64' or 'hex'" }
		],
		returnType: 'void',
		snippet: "sha256('${1:input}', (digest) => {\n\t$0\n});"
	},
	{
		name: 'toBase64',
		description: 'Encodes string to base64 representation supporting unicode.',
		parameters: [
			{ name: 'input', type: 'string', description: 'String to encode' }
		],
		returnType: 'string',
		snippet: "toBase64('${1:input}')"
	},
	{
		name: 'updateConsentState',
		description: 'Pushes consent update to data layer for immediate processing.',
		parameters: [
			{ name: 'consentSettings', type: 'object', description: "Consent type mappings to 'granted'/'denied'" }
		],
		returnType: 'void',
		snippet: "updateConsentState({\n\t'ad_storage': '${1|granted,denied|}',\n\t'analytics_storage': '${2|granted,denied|}'\n});"
	},

	// Test APIs
	{
		name: 'assertApi',
		description: 'Returns a matcher object for making assertions about API calls in tests.',
		parameters: [
			{ name: 'apiName', type: 'string', description: 'The name of the API to assert on' }
		],
		returnType: 'object',
		snippet: "assertApi('${1:apiName}').${2|wasCalled,wasNotCalled,wasCalledWith|}($0)",
		isTestApi: true
	},
	{
		name: 'assertThat',
		description: 'Returns a matcher object for making assertions about values in tests.',
		parameters: [
			{ name: 'actual', type: 'any', description: 'The value to assert on' },
			{ name: 'message', type: 'string', optional: true, description: 'Optional failure message' }
		],
		returnType: 'object',
		snippet: "assertThat(${1:actual}).${2|isEqualTo,isNotEqualTo,isTrue,isFalse,isUndefined,isDefined|}($0)",
		isTestApi: true
	},
	{
		name: 'fail',
		description: 'Immediately fails the current test with an optional message.',
		parameters: [
			{ name: 'message', type: 'string', optional: true, description: 'Failure message' }
		],
		returnType: 'void',
		snippet: "fail('${1:message}')",
		isTestApi: true
	},
	{
		name: 'mock',
		description: 'Mocks a sandboxed API to return the specified value.',
		parameters: [
			{ name: 'apiName', type: 'string', description: 'The name of the API to mock' },
			{ name: 'returnValue', type: 'any', description: 'The value the mock should return' }
		],
		returnType: 'void',
		snippet: "mock('${1:apiName}', ${2:returnValue})",
		isTestApi: true
	},
	{
		name: 'mockObject',
		description: 'Mocks object-returning APIs with a custom object.',
		parameters: [
			{ name: 'apiName', type: 'string', description: 'The name of the API to mock' },
			{ name: 'objectMock', type: 'object', description: 'The mock object to return' }
		],
		returnType: 'void',
		snippet: "mockObject('${1:apiName}', {\n\t$0\n})",
		isTestApi: true
	},
	{
		name: 'runCode',
		description: 'Runs the template code with the provided data object in the test environment.',
		parameters: [
			{ name: 'data', type: 'object', description: 'Data object passed to the template' }
		],
		returnType: 'any',
		snippet: 'runCode(${1:data})',
		isTestApi: true
	}
];

// Object-based APIs that are accessed via require()
export const GTM_SANDBOX_OBJECTS: Record<string, { description: string; methods: { name: string; description: string; signature: string; snippet: string }[] }> = {
	JSON: {
		description: 'Provides JSON parsing and stringification.',
		methods: [
			{ name: 'parse', description: 'Parses a JSON string.', signature: '(jsonString: string) => any', snippet: "JSON.parse('${1:jsonString}')" },
			{ name: 'stringify', description: 'Converts a value to a JSON string.', signature: '(value: any) => string', snippet: 'JSON.stringify(${1:value})' }
		]
	},
	localStorage: {
		description: 'Provides access to browser local storage.',
		methods: [
			{ name: 'getItem', description: 'Gets an item from local storage.', signature: '(key: string) => string|null', snippet: "localStorage.getItem('${1:key}')" },
			{ name: 'setItem', description: 'Sets an item in local storage.', signature: '(key: string, value: string) => void', snippet: "localStorage.setItem('${1:key}', '${2:value}')" },
			{ name: 'removeItem', description: 'Removes an item from local storage.', signature: '(key: string) => void', snippet: "localStorage.removeItem('${1:key}')" }
		]
	},
	templateStorage: {
		description: 'Provides template-scoped storage that persists across tag executions.',
		methods: [
			{ name: 'getItem', description: 'Gets an item from template storage.', signature: '(key: string) => any', snippet: "templateStorage.getItem('${1:key}')" },
			{ name: 'setItem', description: 'Sets an item in template storage.', signature: '(key: string, value: any) => void', snippet: "templateStorage.setItem('${1:key}', ${2:value})" },
			{ name: 'removeItem', description: 'Removes an item from template storage.', signature: '(key: string) => void', snippet: "templateStorage.removeItem('${1:key}')" },
			{ name: 'clear', description: 'Clears all items from template storage.', signature: '() => void', snippet: 'templateStorage.clear()' }
		]
	},
	Math: {
		description: 'Provides mathematical functions.',
		methods: [
			{ name: 'abs', description: 'Returns the absolute value.', signature: '(x: number) => number', snippet: 'Math.abs(${1:x})' },
			{ name: 'floor', description: 'Returns the largest integer less than or equal to x.', signature: '(x: number) => number', snippet: 'Math.floor(${1:x})' },
			{ name: 'ceil', description: 'Returns the smallest integer greater than or equal to x.', signature: '(x: number) => number', snippet: 'Math.ceil(${1:x})' },
			{ name: 'round', description: 'Returns x rounded to the nearest integer.', signature: '(x: number) => number', snippet: 'Math.round(${1:x})' },
			{ name: 'max', description: 'Returns the largest of the given numbers.', signature: '(...values: number[]) => number', snippet: 'Math.max(${1:a}, ${2:b})' },
			{ name: 'min', description: 'Returns the smallest of the given numbers.', signature: '(...values: number[]) => number', snippet: 'Math.min(${1:a}, ${2:b})' },
			{ name: 'pow', description: 'Returns base raised to the power of exponent.', signature: '(base: number, exponent: number) => number', snippet: 'Math.pow(${1:base}, ${2:exponent})' },
			{ name: 'sqrt', description: 'Returns the square root of x.', signature: '(x: number) => number', snippet: 'Math.sqrt(${1:x})' }
		]
	},
	Object: {
		description: 'Provides object manipulation methods.',
		methods: [
			{ name: 'keys', description: 'Returns an array of object\'s own property names.', signature: '(obj: object) => string[]', snippet: 'Object.keys(${1:obj})' },
			{ name: 'values', description: 'Returns an array of object\'s own property values.', signature: '(obj: object) => any[]', snippet: 'Object.values(${1:obj})' },
			{ name: 'entries', description: 'Returns an array of object\'s own [key, value] pairs.', signature: '(obj: object) => [string, any][]', snippet: 'Object.entries(${1:obj})' },
			{ name: 'freeze', description: 'Freezes an object, preventing modifications.', signature: '(obj: object) => object', snippet: 'Object.freeze(${1:obj})' },
			{ name: 'delete', description: 'Deletes a property from an object.', signature: '(obj: object, key: string) => void', snippet: "Object.delete(${1:obj}, '${2:key}')" }
		]
	}
};

// Server-side only APIs
export const GTM_SERVER_APIS: GtmApiDefinition[] = [
	// Request/Response Handling
	{
		name: 'claimRequest',
		description: 'Claims the request for this client, preventing other clients from processing it.',
		parameters: [],
		returnType: 'void',
		snippet: 'claimRequest()',
		serverOnly: true
	},
	{
		name: 'getRequestBody',
		description: 'Returns the request body as a string, if present.',
		parameters: [],
		returnType: 'string|undefined',
		snippet: 'getRequestBody()',
		serverOnly: true
	},
	{
		name: 'getRequestHeader',
		description: 'Returns the value of the named HTTP request header.',
		parameters: [
			{ name: 'headerName', type: 'string', description: 'The header name to retrieve' }
		],
		returnType: 'string|undefined',
		snippet: "getRequestHeader('${1:headerName}')",
		serverOnly: true
	},
	{
		name: 'getRequestMethod',
		description: 'Returns the HTTP request method (GET, POST, etc.).',
		parameters: [],
		returnType: 'string',
		snippet: 'getRequestMethod()',
		serverOnly: true
	},
	{
		name: 'getRequestPath',
		description: 'Returns the request path without the query string.',
		parameters: [],
		returnType: 'string',
		snippet: 'getRequestPath()',
		serverOnly: true
	},
	{
		name: 'getRequestQueryParameter',
		description: 'Returns the decoded value of the named query parameter.',
		parameters: [
			{ name: 'name', type: 'string', description: 'The query parameter name' }
		],
		returnType: 'string|undefined',
		snippet: "getRequestQueryParameter('${1:name}')",
		serverOnly: true
	},
	{
		name: 'getRequestQueryParameters',
		description: 'Returns all query parameters as an object.',
		parameters: [],
		returnType: 'object',
		snippet: 'getRequestQueryParameters()',
		serverOnly: true
	},
	{
		name: 'getRequestQueryString',
		description: 'Returns the request query string without the leading question mark.',
		parameters: [],
		returnType: 'string',
		snippet: 'getRequestQueryString()',
		serverOnly: true
	},
	{
		name: 'setResponseBody',
		description: 'Sets the HTTP response body.',
		parameters: [
			{ name: 'body', type: 'string', description: 'The response body content' },
			{ name: 'encoding', type: 'string', optional: true, description: 'The character encoding' }
		],
		returnType: 'void',
		snippet: "setResponseBody('${1:body}')",
		serverOnly: true
	},
	{
		name: 'setResponseHeader',
		description: 'Sets an HTTP response header.',
		parameters: [
			{ name: 'name', type: 'string', description: 'The header name' },
			{ name: 'value', type: 'string', description: 'The header value' }
		],
		returnType: 'void',
		snippet: "setResponseHeader('${1:name}', '${2:value}')",
		serverOnly: true
	},
	{
		name: 'setResponseStatus',
		description: 'Sets the HTTP response status code.',
		parameters: [
			{ name: 'statusCode', type: 'number', description: 'The HTTP status code' }
		],
		returnType: 'void',
		snippet: 'setResponseStatus(${1:200})',
		serverOnly: true
	},
	{
		name: 'setPixelResponse',
		description: 'Sets the response body to a 1x1 GIF image and sets appropriate headers.',
		parameters: [],
		returnType: 'void',
		snippet: 'setPixelResponse()',
		serverOnly: true
	},
	{
		name: 'returnResponse',
		description: 'Flushes the response that was previously set using setResponseBody, setResponseHeader, etc.',
		parameters: [],
		returnType: 'void',
		snippet: 'returnResponse()',
		serverOnly: true
	},

	// Event Data
	{
		name: 'getAllEventData',
		description: 'Returns a copy of the complete event data object.',
		parameters: [],
		returnType: 'object',
		snippet: 'getAllEventData()',
		serverOnly: true
	},
	{
		name: 'getEventData',
		description: 'Returns a copy of the value at the given path in the event data.',
		parameters: [
			{ name: 'keyPath', type: 'string', description: 'Dot-notation path to the value' }
		],
		returnType: 'any',
		snippet: "getEventData('${1:keyPath}')",
		serverOnly: true
	},

	// HTTP Communication
	{
		name: 'sendHttpGet',
		description: 'Makes an HTTP GET request to the specified URL.',
		parameters: [
			{ name: 'url', type: 'string', description: 'The URL to request' },
			{ name: 'options', type: '{ headers?: object, timeout?: number }', optional: true, description: 'Request options' }
		],
		returnType: 'Promise<{ statusCode: number, headers: object, body: string }>',
		snippet: "sendHttpGet('${1:url}').then((result) => {\n\t$0\n});",
		serverOnly: true
	},
	{
		name: 'sendHttpRequest',
		description: 'Makes an HTTP request with customizable method and body.',
		parameters: [
			{ name: 'url', type: 'string', description: 'The URL to request' },
			{ name: 'options', type: '{ method?: string, headers?: object, timeout?: number }', optional: true, description: 'Request options' },
			{ name: 'body', type: 'string', optional: true, description: 'Request body' }
		],
		returnType: 'Promise<{ statusCode: number, headers: object, body: string }>',
		snippet: "sendHttpRequest('${1:url}', { method: '${2|GET,POST,PUT,DELETE|}', headers: { 'Content-Type': 'application/json' } }, '${3:body}').then((result) => {\n\t$0\n});",
		serverOnly: true
	},
	{
		name: 'sendEventToGoogleAnalytics',
		description: 'Sends a single event using Common Event Data to Google Analytics.',
		parameters: [
			{ name: 'event', type: 'object', description: 'The event data to send' }
		],
		returnType: 'Promise',
		snippet: 'sendEventToGoogleAnalytics(${1:event})',
		serverOnly: true
	},
	{
		name: 'sendPixelFromBrowser',
		description: 'Sends a command to the browser to load the provided URL as an img tag.',
		parameters: [
			{ name: 'url', type: 'string', description: 'The URL to load' }
		],
		returnType: 'boolean',
		snippet: "sendPixelFromBrowser('${1:url}')",
		serverOnly: true
	},

	// Cryptography
	{
		name: 'sha256Sync',
		description: 'Synchronously computes the SHA-256 hash of the input.',
		parameters: [
			{ name: 'input', type: 'string', description: 'The string to hash' },
			{ name: 'options', type: "{ outputEncoding?: 'base64'|'hex' }", optional: true, description: 'Output encoding' }
		],
		returnType: 'string',
		snippet: "sha256Sync('${1:input}')",
		serverOnly: true
	},
	{
		name: 'hmacSha256',
		description: 'Computes an HMAC-SHA256 signature using a stored key.',
		parameters: [
			{ name: 'data', type: 'string', description: 'The data to sign' },
			{ name: 'keyId', type: 'string', description: 'The ID of the stored key' },
			{ name: 'options', type: "{ outputEncoding?: 'base64'|'hex' }", optional: true, description: 'Output encoding' }
		],
		returnType: 'string',
		snippet: "hmacSha256('${1:data}', '${2:keyId}')",
		serverOnly: true
	},

	// URL & Domain
	{
		name: 'computeEffectiveTldPlusOne',
		description: 'Returns the effective top-level domain plus one (eTLD+1) for the given domain or URL.',
		parameters: [
			{ name: 'domainOrUrl', type: 'string', description: 'A domain name or URL' }
		],
		returnType: 'string',
		snippet: "computeEffectiveTldPlusOne('${1:domainOrUrl}')",
		serverOnly: true
	},

	// Container & Tag Execution
	{
		name: 'runContainer',
		description: 'Runs the container logic (variables, triggers, tags) in the scope of an event.',
		parameters: [
			{ name: 'event', type: 'object', description: 'The event data' },
			{ name: 'onComplete', type: '() => void', optional: true, description: 'Callback when complete' },
			{ name: 'onStart', type: '() => void', optional: true, description: 'Callback when starting' }
		],
		returnType: 'void',
		snippet: 'runContainer(${1:event}, () => {\n\t$0\n})',
		serverOnly: true
	},
	{
		name: 'getClientName',
		description: 'Returns the name of the current client.',
		parameters: [],
		returnType: 'string',
		snippet: 'getClientName()',
		serverOnly: true
	},
	{
		name: 'getRemoteAddress',
		description: 'Returns a string representation of the IP address where the request originated.',
		parameters: [],
		returnType: 'string',
		snippet: 'getRemoteAddress()',
		serverOnly: true
	},

	// Google Cloud Integration
	{
		name: 'getGoogleAuth',
		description: 'Returns an authorization object for Google Cloud APIs.',
		parameters: [
			{ name: 'scopes', type: 'string[]', description: 'Array of OAuth scopes' }
		],
		returnType: 'object',
		snippet: "getGoogleAuth(['${1:scope}'])",
		serverOnly: true
	},
	{
		name: 'getGoogleScript',
		description: 'Retrieves a resource from a predetermined set of Google scripts.',
		parameters: [
			{ name: 'script', type: 'string', description: 'The script identifier' },
			{ name: 'options', type: 'object', optional: true, description: 'Script options' }
		],
		returnType: 'Promise',
		snippet: "getGoogleScript('${1:script}')",
		serverOnly: true
	},

	// Measurement Protocol
	{
		name: 'isRequestMpv1',
		description: 'Returns true if the incoming request is a Measurement Protocol V1 request.',
		parameters: [],
		returnType: 'boolean',
		snippet: 'isRequestMpv1()',
		serverOnly: true
	},
	{
		name: 'isRequestMpv2',
		description: 'Returns true if the incoming request is a Measurement Protocol V2 request.',
		parameters: [],
		returnType: 'boolean',
		snippet: 'isRequestMpv2()',
		serverOnly: true
	},
	{
		name: 'extractEventsFromMpv1',
		description: 'Translates an incoming Measurement Protocol V1 request into a list of events.',
		parameters: [],
		returnType: 'object[]',
		snippet: 'extractEventsFromMpv1()',
		serverOnly: true
	},
	{
		name: 'extractEventsFromMpv2',
		description: 'Translates an incoming Measurement Protocol V2 request into a list of events.',
		parameters: [],
		returnType: 'object[]',
		snippet: 'extractEventsFromMpv2()',
		serverOnly: true
	},

	// Regular Expressions
	{
		name: 'createRegex',
		description: 'Creates a new regex instance and returns it wrapped in an object.',
		parameters: [
			{ name: 'pattern', type: 'string', description: 'The regex pattern' },
			{ name: 'flags', type: 'string', optional: true, description: 'Regex flags (g, i, m, etc.)' }
		],
		returnType: 'object|null',
		snippet: "createRegex('${1:pattern}', '${2:flags}')",
		serverOnly: true
	},
	{
		name: 'testRegex',
		description: 'Tests a string against a regex created via createRegex.',
		parameters: [
			{ name: 'regex', type: 'object', description: 'A regex object from createRegex' },
			{ name: 'string', type: 'string', description: 'The string to test' }
		],
		returnType: 'boolean',
		snippet: 'testRegex(${1:regex}, ${2:string})',
		serverOnly: true
	},

	// Messaging
	{
		name: 'addMessageListener',
		description: 'Adds a listener for messages of the specified type.',
		parameters: [
			{ name: 'messageType', type: 'string', description: 'The message type to listen for' },
			{ name: 'callback', type: '(message: object) => void', description: 'Callback function' }
		],
		returnType: 'void',
		snippet: "addMessageListener('${1:messageType}', (message) => {\n\t$0\n})",
		serverOnly: true
	},
	{
		name: 'sendMessage',
		description: 'Sends a message of the specified type to registered listeners.',
		parameters: [
			{ name: 'messageType', type: 'string', description: 'The message type' },
			{ name: 'message', type: 'object', description: 'The message payload' }
		],
		returnType: 'void',
		snippet: "sendMessage('${1:messageType}', { $0 })",
		serverOnly: true
	},
	{
		name: 'hasMessageListener',
		description: 'Returns true if a listener is registered for the message type.',
		parameters: [
			{ name: 'messageType', type: 'string', description: 'The message type to check' }
		],
		returnType: 'boolean',
		snippet: "hasMessageListener('${1:messageType}')",
		serverOnly: true
	},

	// Template Data Storage (Server)
	{
		name: 'templateDataStorage',
		description: 'Returns an object with methods for accessing template data storage.',
		parameters: [],
		returnType: '{ getItemCopy: (key: string) => any, setItemCopy: (key: string, value: any) => void, removeItem: (key: string) => void }',
		snippet: 'templateDataStorage()',
		serverOnly: true
	}
];

// Server-side object APIs
export const GTM_SERVER_OBJECTS: Record<string, { description: string; methods: { name: string; description: string; signature: string; snippet: string }[] }> = {
	BigQuery: {
		description: 'Provides access to BigQuery for data insertion.',
		methods: [
			{
				name: 'insert',
				description: 'Writes data rows into a BigQuery table.',
				signature: '(connectionInfo: { projectId: string, datasetId: string, tableId: string }, rows: object[], options?: object) => Promise',
				snippet: "BigQuery.insert({\n\tprojectId: '${1:projectId}',\n\tdatasetId: '${2:datasetId}',\n\ttableId: '${3:tableId}'\n}, [{ $0 }])"
			}
		]
	},
	Firestore: {
		description: 'Provides access to Firestore database operations.',
		methods: [
			{
				name: 'read',
				description: 'Reads a document from Firestore.',
				signature: '(path: string, options?: { projectId?: string }) => Promise<object>',
				snippet: "Firestore.read('${1:collection/document}')"
			},
			{
				name: 'write',
				description: 'Writes data to a Firestore document or collection.',
				signature: '(path: string, input: object, options?: { projectId?: string, merge?: boolean }) => Promise',
				snippet: "Firestore.write('${1:collection/document}', { $0 })"
			},
			{
				name: 'query',
				description: 'Queries a Firestore collection with conditions.',
				signature: '(collection: string, queryConditions: Array<{ fieldPath: string, operator: string, value: any }>, options?: object) => Promise<object[]>',
				snippet: "Firestore.query('${1:collection}', [{ fieldPath: '${2:field}', operator: '${3|==,!=,<,<=,>,>=,in,not-in,array-contains|}', value: ${4:value} }])"
			},
			{
				name: 'runTransaction',
				description: 'Allows atomically reading and writing from Firestore.',
				signature: '(callback: (transaction: object) => any, options?: object) => Promise',
				snippet: 'Firestore.runTransaction((transaction) => {\n\t$0\n})'
			}
		]
	},
	Promise: {
		description: 'Provides Promise creation and utility methods.',
		methods: [
			{
				name: 'create',
				description: 'Creates a new Promise.',
				signature: '(resolver: (resolve: function, reject: function) => void) => Promise',
				snippet: 'Promise.create((resolve, reject) => {\n\t$0\n})'
			},
			{
				name: 'all',
				description: 'Returns a promise that resolves when all input promises resolve.',
				signature: '(promises: Promise[]) => Promise<any[]>',
				snippet: 'Promise.all([${1:promises}])'
			}
		]
	}
};

// API names that require the require() function to access (Web)
export const REQUIRE_BASED_APIS = [
	'addConsentListener',
	'addEventCallback',
	'aliasInWindow',
	'callInWindow',
	'callLater',
	'copyFromDataLayer',
	'copyFromWindow',
	'createArgumentsQueue',
	'createQueue',
	'decodeUri',
	'decodeUriComponent',
	'encodeUri',
	'encodeUriComponent',
	'fromBase64',
	'generateRandom',
	'getContainerVersion',
	'getCookieValues',
	'getQueryParameters',
	'getReferrerQueryParameters',
	'getReferrerUrl',
	'getTimestamp',
	'getTimestampMillis',
	'getType',
	'getUrl',
	'gtagSet',
	'injectHiddenIframe',
	'injectScript',
	'isConsentGranted',
	'JSON',
	'localStorage',
	'logToConsole',
	'makeInteger',
	'makeNumber',
	'makeString',
	'makeTableMap',
	'Math',
	'Object',
	'parseUrl',
	'queryPermission',
	'readAnalyticsStorage',
	'readCharacterSet',
	'readTitle',
	'sendPixel',
	'setCookie',
	'setDefaultConsentState',
	'setInWindow',
	'sha256',
	'templateStorage',
	'toBase64',
	'updateConsentState'
];

// API names that require the require() function to access (Server)
export const REQUIRE_BASED_SERVER_APIS = [
	'addEventCallback',
	'addMessageListener',
	'BigQuery',
	'callLater',
	'claimRequest',
	'computeEffectiveTldPlusOne',
	'createRegex',
	'decodeUri',
	'decodeUriComponent',
	'encodeUri',
	'encodeUriComponent',
	'extractEventsFromMpv1',
	'extractEventsFromMpv2',
	'Firestore',
	'fromBase64',
	'generateRandom',
	'getAllEventData',
	'getClientName',
	'getContainerVersion',
	'getCookieValues',
	'getEventData',
	'getGoogleAuth',
	'getGoogleScript',
	'getRemoteAddress',
	'getRequestBody',
	'getRequestHeader',
	'getRequestMethod',
	'getRequestPath',
	'getRequestQueryParameter',
	'getRequestQueryParameters',
	'getRequestQueryString',
	'getTimestampMillis',
	'getType',
	'hasMessageListener',
	'hmacSha256',
	'isRequestMpv1',
	'isRequestMpv2',
	'JSON',
	'logToConsole',
	'makeInteger',
	'makeNumber',
	'makeString',
	'makeTableMap',
	'Math',
	'Object',
	'parseUrl',
	'Promise',
	'returnResponse',
	'runContainer',
	'sendEventToGoogleAnalytics',
	'sendHttpGet',
	'sendHttpRequest',
	'sendMessage',
	'sendPixelFromBrowser',
	'setCookie',
	'setPixelResponse',
	'setResponseBody',
	'setResponseHeader',
	'setResponseStatus',
	'sha256',
	'sha256Sync',
	'templateDataStorage',
	'testRegex',
	'toBase64'
];
