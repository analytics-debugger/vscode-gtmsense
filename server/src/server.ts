import {
	createConnection,
	TextDocuments,
	ProposedFeatures,
	InitializeParams,
	InitializeResult,
	TextDocumentSyncKind,
	CompletionItem,
	CompletionItemKind,
	Hover,
	MarkupKind,
	Diagnostic,
	DiagnosticSeverity,
	TextDocumentPositionParams,
	CompletionParams,
	InsertTextFormat,
	SignatureHelp,
	SignatureInformation,
	ParameterInformation,
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';

// Create connection
const connection = createConnection(ProposedFeatures.all);

// Document manager
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

// ============================================================================
// GTM API Definitions
// ============================================================================

interface GtmApiParameter {
	name: string;
	type: string;
	optional?: boolean;
	description?: string;
}

interface GtmApiDefinition {
	name: string;
	description: string;
	parameters: GtmApiParameter[];
	returnType: string;
	snippet?: string;
	isTestApi?: boolean;
	deprecated?: boolean;
	deprecatedMessage?: string;
	serverOnly?: boolean;
	webOnly?: boolean;
}

interface GtmObjectMethod {
	name: string;
	description: string;
	signature: string;
	snippet: string;
}

interface GtmObjectDefinition {
	description: string;
	methods: GtmObjectMethod[];
}

// Web template APIs - Descriptions from https://developers.google.com/tag-platform/tag-manager/templates/api
const GTM_SANDBOX_APIS: GtmApiDefinition[] = [
	{
		name: 'addConsentListener',
		description: 'Registers a listener function to execute when the state of the specified consent type changes.',
		parameters: [
			{ name: 'consentType', type: 'string', description: 'The consent type to listen for state changes on.' },
			{ name: 'listener', type: 'function', description: 'The function to run when the state of the specified consent type changes.' }
		],
		returnType: 'void',
		snippet: "addConsentListener('${1:consentType}', (consentType, granted) => {\n\t$0\n});"
	},
	{
		name: 'addEventCallback',
		description: 'The addEventCallback API allows you to register a callback function that will be invoked at the end of an event.',
		parameters: [
			{ name: 'callback', type: 'function', description: 'The function to invoke at the end of the event.' }
		],
		returnType: 'void',
		snippet: "addEventCallback((containerId, eventData) => {\n\t$0\n});"
	},
	{
		name: 'aliasInWindow',
		description: 'The aliasInWindow API lets you create an alias (e.g. window.foo = window.bar), which helps to support certain tags that require aliasing.',
		parameters: [
			{ name: 'toPath', type: 'string', description: 'A dot-separated path into the window object where a value should be copied to.' },
			{ name: 'fromPath', type: 'string', description: 'A dot-separated path into window to the value to copy.' }
		],
		returnType: 'boolean',
		snippet: "aliasInWindow('${1:toPath}', '${2:fromPath}')",
		webOnly: true
	},
	{
		name: 'callInWindow',
		description: 'Allows you to call functions from a path off the window object, in a policy-controlled way.',
		parameters: [
			{ name: 'pathToFunction', type: 'string', description: 'A dot-separated path to the function in window to call.' },
			{ name: 'args', type: 'any', optional: true, description: 'Arguments to be passed to the function.' }
		],
		returnType: 'any',
		snippet: "callInWindow('${1:pathToFunction}'$0)",
		webOnly: true
	},
	{
		name: 'callLater',
		description: 'Schedules a call to a function to occur asynchronously. The function will be called after the current code returns.',
		parameters: [
			{ name: 'function', type: 'function', description: 'The function to call.' }
		],
		returnType: 'void',
		snippet: "callLater(() => {\n\t$0\n});"
	},
	{
		name: 'copyFromDataLayer',
		description: 'Returns the value currently assigned to the given key in the data layer.',
		parameters: [
			{ name: 'key', type: 'string', description: 'The key in the format of \'a.b.c\'.' },
			{ name: 'dataLayerVersion', type: 'number', optional: true, description: 'The optional data layer version. The default value is 2.' }
		],
		returnType: 'any',
		snippet: "copyFromDataLayer('${1:key}')",
		webOnly: true
	},
	{
		name: 'copyFromWindow',
		description: 'Copies a variable from window object. If the value in window can\'t be directly mapped to a type supported in sandboxed JavaScript, undefined will be returned.',
		parameters: [
			{ name: 'key', type: 'string', description: 'The key in the window to copy the value of.' }
		],
		returnType: 'any',
		snippet: "copyFromWindow('${1:key}')",
		webOnly: true
	},
	{
		name: 'createArgumentsQueue',
		description: 'Creates a queue that is populated with argument objects, in support of tag solutions that require it.',
		parameters: [
			{ name: 'fnKey', type: 'string', description: 'The path in window where the function is set, if it does not already exist.' },
			{ name: 'arrayKey', type: 'string', description: 'The path in window where the array is set, if it does not already exist.' }
		],
		returnType: 'function',
		snippet: "createArgumentsQueue('${1:fnKey}', '${2:arrayKey}')",
		webOnly: true
	},
	{
		name: 'createQueue',
		description: 'Creates an array in window (if it doesn\'t already exist) and returns a function that will push values onto that array.',
		parameters: [
			{ name: 'arrayKey', type: 'string', description: 'The key in window where the array is set, if it does not already exist.' }
		],
		returnType: 'function',
		snippet: "createQueue('${1:arrayKey}')",
		webOnly: true
	},
	{
		name: 'decodeUri',
		description: 'Decodes any encoded characters in the provided URI. Returns a string that represents the decoded URI.',
		parameters: [
			{ name: 'encoded_uri', type: 'string', description: 'A URI that has been encoded by encodeUri() or by other means.' }
		],
		returnType: 'string|undefined',
		snippet: "decodeUri('${1:encoded_uri}')"
	},
	{
		name: 'decodeUriComponent',
		description: 'Decodes any encoded characters in the provided URI component. Returns a string that represents the decoded URI component.',
		parameters: [
			{ name: 'encoded_uri_component', type: 'string', description: 'A URI component that has been encoded by encodeUriComponent() or by other means.' }
		],
		returnType: 'string|undefined',
		snippet: "decodeUriComponent('${1:encoded_uri_component}')"
	},
	{
		name: 'encodeUri',
		description: 'Returns an encoded Uniform Resource Identifier (URI) by escaping special characters.',
		parameters: [
			{ name: 'uri', type: 'string', description: 'A complete URI.' }
		],
		returnType: 'string|undefined',
		snippet: "encodeUri('${1:uri}')"
	},
	{
		name: 'encodeUriComponent',
		description: 'Returns an encoded Uniform Resource Identifier (URI) by escaping special characters.',
		parameters: [
			{ name: 'str', type: 'string', description: 'A component of a URI.' }
		],
		returnType: 'string|undefined',
		snippet: "encodeUriComponent('${1:str}')"
	},
	{
		name: 'fromBase64',
		description: 'The fromBase64 API lets you to decode strings from their base64 representation.',
		parameters: [
			{ name: 'base64EncodedString', type: 'string', description: 'Base64 encoded string.' }
		],
		returnType: 'string|undefined',
		snippet: "fromBase64('${1:base64EncodedString}')"
	},
	{
		name: 'generateRandom',
		description: 'Returns a random number (integer) within the given range.',
		parameters: [
			{ name: 'min', type: 'number', description: 'Minimum potential value of the returned integer.' },
			{ name: 'max', type: 'number', description: 'Maximum potential value of the returned integer.' }
		],
		returnType: 'number',
		snippet: 'generateRandom(${1:min}, ${2:max})'
	},
	{
		name: 'getContainerVersion',
		description: 'Returns an object containing data about the current container.',
		parameters: [],
		returnType: '{ containerId: string, debugMode: boolean, environmentName: string, environmentMode: boolean, previewMode: boolean, version: string }',
		snippet: 'getContainerVersion()'
	},
	{
		name: 'getCookieValues',
		description: 'Returns the values of all cookies with the given name.',
		parameters: [
			{ name: 'name', type: 'string', description: 'Name of the cookie.' },
			{ name: 'decode', type: 'boolean', optional: true, description: 'Controls whether the cookie values are to be decoded with JavaScript\'s decodeURIComponent().' }
		],
		returnType: 'Array',
		snippet: "getCookieValues('${1:name}')"
	},
	{
		name: 'getQueryParameters',
		description: 'Returns the first or all of the parameters for the current URL\'s queryKey.',
		parameters: [
			{ name: 'queryKey', type: 'string', description: 'The key to read from the query parameters.' },
			{ name: 'retrieveAll', type: 'boolean', optional: true, description: 'Whether to retrieve all the values.' }
		],
		returnType: 'string|Array',
		snippet: "getQueryParameters('${1:queryKey}')"
	},
	{
		name: 'getReferrerQueryParameters',
		description: 'The getReferrerQueryParameters API acts the same way as getQueryParameters, except it acts on the referrer instead of the current URL.',
		parameters: [
			{ name: 'queryKey', type: 'string', description: 'The key to read from the query parameters.' },
			{ name: 'retrieveAll', type: 'boolean', optional: true, description: 'Whether to retrieve all the values.' }
		],
		returnType: 'string|Array',
		snippet: "getReferrerQueryParameters('${1:queryKey}')"
	},
	{
		name: 'getReferrerUrl',
		description: 'Given a component type, the API reads the document object for the referrer and returns a string that represents a portion of the referrer.',
		parameters: [
			{ name: 'component', type: 'string', optional: true, description: 'The component to return from the URL.' }
		],
		returnType: 'string',
		snippet: "getReferrerUrl('${1|protocol,host,port,path,query,extension|}')"
	},
	{
		name: 'getTimestamp',
		description: 'Deprecated. Prefer getTimestampMillis. Returns a number that represents the current time in milliseconds since Unix epoch.',
		parameters: [],
		returnType: 'number',
		snippet: 'getTimestamp()',
		deprecated: true,
		deprecatedMessage: 'Use getTimestampMillis instead.'
	},
	{
		name: 'getTimestampMillis',
		description: 'Returns a number that represents the current time in milliseconds since Unix epoch, as returned by Date.now().',
		parameters: [],
		returnType: 'number',
		snippet: 'getTimestampMillis()'
	},
	{
		name: 'getType',
		description: 'Returns a string describing the given value\'s type. Unlike typeof, getType differentiates between array and object.',
		parameters: [
			{ name: 'data', type: 'any', description: 'The input value.' }
		],
		returnType: 'string',
		snippet: 'getType(${1:data})'
	},
	{
		name: 'getUrl',
		description: 'Returns a string that represents all or a portion of the current URL, given a component type, and some configuration parameters.',
		parameters: [
			{ name: 'component', type: 'string', optional: true, description: 'The component to return from the URL. Must be one of: protocol, host, port, path, query, extension, fragment.' }
		],
		returnType: 'string',
		snippet: "getUrl('${1|protocol,host,port,path,query,extension,fragment|}')"
	},
	{
		name: 'gtagSet',
		description: 'Pushes a gtag set command to the data layer, to be processed as soon as possible after the current event and any tags it triggered are finished processing.',
		parameters: [
			{ name: 'Object', type: 'object', description: 'An object that updates the global state for its containing properties.' }
		],
		returnType: 'void',
		snippet: 'gtagSet({ ${1:key}: ${2:value} })'
	},
	{
		name: 'injectHiddenIframe',
		description: 'Adds an invisible iframe to the page.',
		parameters: [
			{ name: 'url', type: 'string', description: 'The URL to be used as the value of the iframe\'s src attribute.' },
			{ name: 'onSuccess', type: 'function', optional: true, description: 'Called when the frame loads successfully.' }
		],
		returnType: 'void',
		snippet: "injectHiddenIframe('${1:url}', () => {\n\t$0\n});",
		webOnly: true
	},
	{
		name: 'injectScript',
		description: 'Adds a script tag to the page to load the given URL asynchronously. The callbacks are given as function instances, and are wrapped in JavaScript functions that call through to them.',
		parameters: [
			{ name: 'url', type: 'string', description: 'The address of the script to be injected.' },
			{ name: 'onSuccess', type: 'function', optional: true, description: 'Called when the script loads successfully.' },
			{ name: 'onFailure', type: 'function', optional: true, description: 'Called when the script fails to load.' },
			{ name: 'cacheToken', type: 'string', optional: true, description: 'Optional string used to indicate the given URL should be cached.' }
		],
		returnType: 'void',
		snippet: "injectScript('${1:url}', () => {\n\t// onSuccess\n\t$0\n}, () => {\n\t// onFailure\n}, '${2:cacheToken}');",
		webOnly: true
	},
	{
		name: 'isConsentGranted',
		description: 'Returns true if the specified consent type is granted.',
		parameters: [
			{ name: 'consentType', type: 'string', description: 'The consent type to check the state of.' }
		],
		returnType: 'boolean',
		snippet: "isConsentGranted('${1|ad_storage,analytics_storage,functionality_storage,personalization_storage,security_storage|}')"
	},
	{
		name: 'logToConsole',
		description: 'Logs arguments to the browser console.',
		parameters: [
			{ name: 'obj1 [, obj2,... objN]', type: 'any', description: 'Arguments' }
		],
		returnType: 'void',
		snippet: 'logToConsole(${1:message})'
	},
	{
		name: 'makeInteger',
		description: 'Converts the given value to a number (integer).',
		parameters: [
			{ name: 'value', type: 'any', description: 'The value to convert.' }
		],
		returnType: 'number',
		snippet: 'makeInteger(${1:value})'
	},
	{
		name: 'makeNumber',
		description: 'Converts the given value to a number.',
		parameters: [
			{ name: 'value', type: 'any', description: 'The value to convert.' }
		],
		returnType: 'number',
		snippet: 'makeNumber(${1:value})'
	},
	{
		name: 'makeString',
		description: 'Returns the given value as a string.',
		parameters: [
			{ name: 'value', type: 'any', description: 'The value to convert.' }
		],
		returnType: 'string',
		snippet: 'makeString(${1:value})'
	},
	{
		name: 'makeTableMap',
		description: 'Converts a simple table object with two columns to a Map.',
		parameters: [
			{ name: 'tableObj', type: 'Array', description: 'The table object to convert. It\'s a list of maps where each Map represents a row in the table.' },
			{ name: 'keyColumnName', type: 'string', description: 'Name of the column whose values will become keys in the converted Map.' },
			{ name: 'valueColumnName', type: 'string', description: 'Name of the column whose values will become values in the converted Map.' }
		],
		returnType: 'Object',
		snippet: "makeTableMap(${1:tableObj}, '${2:keyColumn}', '${3:valueColumn}')"
	},
	{
		name: 'parseUrl',
		description: 'Returns an object that contains all of a given URL\'s component parts, similar to the URL object.',
		parameters: [
			{ name: 'url', type: 'string', description: 'The full url that will be parsed.' }
		],
		returnType: '{ href: string, origin: string, protocol: string, username: string, password: string, host: string, hostname: string, port: string, pathname: string, search: string, searchParams: Object, hash: string }',
		snippet: "parseUrl('${1:url}')"
	},
	{
		name: 'queryPermission',
		description: 'Query the allowed and narrowed permissions. Returns a boolean: true if a permission is granted, false otherwise.',
		parameters: [
			{ name: 'permission', type: 'string', description: 'Name of the permission.' },
			{ name: 'functionArgs', type: 'any', optional: true, description: 'Function arguments vary based on the permission being queried.' }
		],
		returnType: 'boolean',
		snippet: "queryPermission('${1:permission}'$0)"
	},
	{
		name: 'readCharacterSet',
		description: 'Returns the value of document.characterSet.',
		parameters: [],
		returnType: 'string',
		snippet: 'readCharacterSet()'
	},
	{
		name: 'readTitle',
		description: 'Returns the value of document.title.',
		parameters: [],
		returnType: 'string',
		snippet: 'readTitle()'
	},
	{
		name: 'sendPixel',
		description: 'Makes a GET request to a specified URL endpoint.',
		parameters: [
			{ name: 'url', type: 'string', description: 'Where to send the pixel.' },
			{ name: 'onSuccess', type: 'function', optional: true, description: 'Called when the pixel successfully loads.' },
			{ name: 'onFailure', type: 'function', optional: true, description: 'Called when the pixel fails to load.' }
		],
		returnType: 'void',
		snippet: "sendPixel('${1:url}', () => {\n\t// onSuccess\n\t$0\n}, () => {\n\t// onFailure\n});",
		webOnly: true
	},
	{
		name: 'setCookie',
		description: 'Sets or deletes the cookie with the specified name, value, and options.',
		parameters: [
			{ name: 'name', type: 'string', description: 'Name of the cookie.' },
			{ name: 'value', type: 'string', description: 'Value of the cookie.' },
			{ name: 'options', type: 'object', optional: true, description: 'Specifies the Domain, Path, Expires, Max-Age, Secure, and SameSite attributes.' },
			{ name: 'encode', type: 'boolean', optional: true, description: 'Controls whether the cookie value is to be encoded with JavaScript\'s encodeURIComponent().' }
		],
		returnType: 'void',
		snippet: "setCookie('${1:name}', '${2:value}', { domain: '${3:auto}', path: '/', 'max-age': ${4:63072000} });",
		webOnly: true
	},
	{
		name: 'setDefaultConsentState',
		description: 'Pushes a default consent update to the data layer, to be processed as soon as possible after the current event.',
		parameters: [
			{ name: 'consentSettings', type: 'object', description: 'An object that defines the default state for the specified consent types.' }
		],
		returnType: 'void',
		snippet: "setDefaultConsentState({\n\t'ad_storage': '${1|granted,denied|}',\n\t'analytics_storage': '${2|granted,denied|}',\n\twait_for_update: ${3:500}\n});"
	},
	{
		name: 'setInWindow',
		description: 'Sets the given value in window at the given key.',
		parameters: [
			{ name: 'key', type: 'string', description: 'The key in window in which to set the value.' },
			{ name: 'value', type: 'any', description: 'The value to set in window.' },
			{ name: 'overrideExisting', type: 'boolean', description: 'The flag that indicates that the value should be set in window regardless of whether there is a value there.' }
		],
		returnType: 'boolean',
		snippet: "setInWindow('${1:key}', ${2:value}, ${3|true,false|})",
		webOnly: true
	},
	{
		name: 'sha256',
		description: 'Calculates the SHA-256 digest of the input and invokes a callback with the digest encoded in base64, unless the options object specifies a different output encoding.',
		parameters: [
			{ name: 'input', type: 'string', description: 'The string to calculate the hash for.' },
			{ name: 'onSuccess', type: 'function', description: 'Called with the resulting digest, encoded in base64, unless the options object specifies a different output encoding.' },
			{ name: 'onFailure', type: 'function', optional: true, description: 'Called if an error occurs while calculating the digest, or if the browser does not have native support for sha256.' },
			{ name: 'options', type: 'object', optional: true, description: 'Optional options object to specify the output encoding.' }
		],
		returnType: 'void',
		snippet: "sha256('${1:input}', (digest) => {\n\t$0\n});"
	},
	{
		name: 'toBase64',
		description: 'Encodes a string to a base64 representation.',
		parameters: [
			{ name: 'input', type: 'string', description: 'String to encode.' }
		],
		returnType: 'string',
		snippet: "toBase64('${1:input}')"
	},
	{
		name: 'updateConsentState',
		description: 'Pushes a consent update to the data layer, to be processed as soon as possible after the current event and any tags it triggered are finished processing.',
		parameters: [
			{ name: 'consentSettings', type: 'object', description: 'An object that updates the state for the specified consent types. Each property must be a valid consent type, and the value must be either \'granted\' or \'denied\'.' }
		],
		returnType: 'void',
		snippet: "updateConsentState({\n\t'ad_storage': '${1|granted,denied|}',\n\t'analytics_storage': '${2|granted,denied|}'\n});"
	},
	// Test APIs - from https://developers.google.com/tag-platform/tag-manager/templates/api
	{
		name: 'assertApi',
		description: 'Returns a matcher object that can be used to make assertions about the given API.',
		parameters: [
			{ name: 'apiName', type: 'string', description: 'Name of the API to check. Same string as passed to require().' }
		],
		returnType: 'object',
		snippet: "assertApi('${1:apiName}').${2|wasCalled,wasNotCalled,wasCalledWith|}($0)",
		isTestApi: true
	},
	{
		name: 'assertThat',
		description: 'Returns a matcher object that can be used to fluently make assertions about a subject.',
		parameters: [
			{ name: 'actual', type: 'any', description: 'The value to run assertion checks on.' },
			{ name: 'opt_message', type: 'string', optional: true, description: 'Optional message to print if the assertion fails.' }
		],
		returnType: 'object',
		snippet: "assertThat(${1:actual}).${2|isEqualTo,isNotEqualTo,isTrue,isFalse,isUndefined,isDefined|}($0)",
		isTestApi: true
	},
	{
		name: 'fail',
		description: 'Immediately fails the current test and prints the given message if provided.',
		parameters: [
			{ name: 'opt_message', type: 'string', optional: true, description: 'Optional error message.' }
		],
		returnType: 'void',
		snippet: "fail('${1:message}')",
		isTestApi: true
	},
	{
		name: 'mock',
		description: 'Allows Sandboxed APIs to be overridden with mock behavior. The mock is safely reverted after each test runs. If the return value is a function, that function will be called in place of the Sandboxed API. If the return value is any other value, that value will be returned in place of the Sandboxed API return value.',
		parameters: [
			{ name: 'apiName', type: 'string', description: 'Name of the API to mock. Same string as passed to require().' },
			{ name: 'returnValue', type: 'any', description: 'The value to return for the API or a function that is called in place of the API.' }
		],
		returnType: 'void',
		snippet: "mock('${1:apiName}', ${2:returnValue})",
		isTestApi: true
	},
	{
		name: 'mockObject',
		description: 'Allows Sandboxed APIs that return an object to be mocked with mock behavior. The mock is safely reverted after each test runs. Must be used with APIs that are an object (e.g. JSON).',
		parameters: [
			{ name: 'apiName', type: 'string', description: 'Name of the API to mock. Same string as passed to require().' },
			{ name: 'objectMock', type: 'object', description: 'The value to return for the API or a function that is called in place of the API.' }
		],
		returnType: 'void',
		snippet: "mockObject('${1:apiName}', { ${2:methodName}: ${3:returnValue} })",
		isTestApi: true
	},
	{
		name: 'runCode',
		description: 'Runs the code for the template (i.e. the content of the Code tab) in the current test environment with a given data object.',
		parameters: [
			{ name: 'data', type: 'object', description: 'Data object to use in the test.' }
		],
		returnType: 'any',
		snippet: 'runCode(${1:data})',
		isTestApi: true
	}
];

// Server-side only APIs
const GTM_SERVER_APIS: GtmApiDefinition[] = [
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
	{
		name: 'setResponseBody',
		description: 'Sets the HTTP response body.',
		parameters: [
			{ name: 'body', type: 'string', description: 'The response body content' }
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
		description: 'Flushes the response that was previously set.',
		parameters: [],
		returnType: 'void',
		snippet: 'returnResponse()',
		serverOnly: true
	},
	{
		name: 'sendHttpGet',
		description: 'Makes an HTTP GET request to the specified URL.',
		parameters: [
			{ name: 'url', type: 'string', description: 'The URL to request' },
			{ name: 'options', type: 'object', optional: true, description: 'Request options' }
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
			{ name: 'options', type: 'object', optional: true, description: 'Request options' },
			{ name: 'body', type: 'string', optional: true, description: 'Request body' }
		],
		returnType: 'Promise<{ statusCode: number, headers: object, body: string }>',
		snippet: "sendHttpRequest('${1:url}', { method: '${2|GET,POST,PUT,DELETE|}' }, '${3:body}').then((result) => {\n\t$0\n});",
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
	{
		name: 'sha256Sync',
		description: 'Synchronously computes the SHA-256 hash of the input.',
		parameters: [
			{ name: 'input', type: 'string', description: 'The string to hash' },
			{ name: 'options', type: 'object', optional: true, description: 'Output encoding options' }
		],
		returnType: 'string',
		snippet: "sha256Sync('${1:input}')",
		serverOnly: true
	},
	{
		name: 'computeEffectiveTldPlusOne',
		description: 'Returns the effective top-level domain plus one (eTLD+1) for the given domain or URL.',
		parameters: [
			{ name: 'domainOrUrl', type: 'string', description: 'A domain name or URL' }
		],
		returnType: 'string',
		snippet: "computeEffectiveTldPlusOne('${1:domainOrUrl}')",
		serverOnly: true
	}
];

// Object-based APIs - from https://developers.google.com/tag-platform/tag-manager/templates/api
const GTM_SANDBOX_OBJECTS: Record<string, GtmObjectDefinition> = {
	JSON: {
		description: 'Returns an object that provides JSON functions.',
		methods: [
			{ name: 'parse', description: 'Parses a JSON string to construct the value or object described by the string. If the value cannot be parsed (e.g. malformed JSON), the function will return undefined. If the input value is not a string, the input will be coerced to a string.', signature: '(stringInput: any) => any', snippet: "JSON.parse('${1:jsonString}')" },
			{ name: 'stringify', description: 'Converts the input into a JSON string. If the value cannot be parsed (e.g. the object has a cycle), the method will return undefined.', signature: '(value: any) => string|undefined', snippet: 'JSON.stringify(${1:value})' }
		]
	},
	Math: {
		description: 'An object providing Math functions.',
		methods: [
			{ name: 'abs', description: 'Returns the absolute value of the input.', signature: '(x: number) => number', snippet: 'Math.abs(${1:x})' },
			{ name: 'floor', description: 'Returns the largest integer less than or equal to the input.', signature: '(x: number) => number', snippet: 'Math.floor(${1:x})' },
			{ name: 'ceil', description: 'Returns the smallest integer greater than or equal to the input.', signature: '(x: number) => number', snippet: 'Math.ceil(${1:x})' },
			{ name: 'round', description: 'Returns the value of the input rounded to the nearest integer.', signature: '(x: number) => number', snippet: 'Math.round(${1:x})' },
			{ name: 'max', description: 'Returns the largest of one or more inputs.', signature: '(...values: number[]) => number', snippet: 'Math.max(${1:a}, ${2:b})' },
			{ name: 'min', description: 'Returns the smallest of one or more inputs.', signature: '(...values: number[]) => number', snippet: 'Math.min(${1:a}, ${2:b})' },
			{ name: 'pow', description: 'Returns base raised to the exponent power.', signature: '(base: number, exponent: number) => number', snippet: 'Math.pow(${1:base}, ${2:exponent})' },
			{ name: 'sqrt', description: 'Returns the positive square root of the input.', signature: '(x: number) => number', snippet: 'Math.sqrt(${1:x})' }
		]
	},
	Object: {
		description: 'Returns an Object that provides Object methods.',
		methods: [
			{ name: 'keys', description: 'Returns an Array of an given object\'s own enumerable property names, in the same order as a for...in loop.', signature: '(obj: object) => string[]', snippet: 'Object.keys(${1:obj})' },
			{ name: 'values', description: 'Returns an Array of a given object\'s own enumerable property values, in the same order as a for...in loop.', signature: '(obj: object) => any[]', snippet: 'Object.values(${1:obj})' },
			{ name: 'entries', description: 'Returns an Array of a given object\'s own enumerable [key, value] pairs, in the same order as a for...in loop.', signature: '(obj: object) => [string, any][]', snippet: 'Object.entries(${1:obj})' },
			{ name: 'freeze', description: 'Freezes an object. Frozen objects can no longer be changed; freezing prevents new properties from being added, existing properties from being removed, and the values of existing properties from being changed. freeze() returns the same object that was passed in.', signature: '(obj: object) => object', snippet: 'Object.freeze(${1:obj})' },
			{ name: 'delete', description: 'Removes the given key from the object. This is equivalent to the delete operator on an object.', signature: '(obj: object, key: string) => boolean', snippet: "Object.delete(${1:obj}, '${2:key}')" }
		]
	},
	localStorage: {
		description: 'Returns an object with methods for accessing local storage.',
		methods: [
			{ name: 'getItem', description: 'Retrieves a value from local storage by key.', signature: '(key: string) => string|null', snippet: "localStorage.getItem('${1:key}')" },
			{ name: 'setItem', description: 'Stores a value in local storage with the specified key.', signature: '(key: string, value: string) => void', snippet: "localStorage.setItem('${1:key}', '${2:value}')" },
			{ name: 'removeItem', description: 'Removes an item from local storage by key.', signature: '(key: string) => void', snippet: "localStorage.removeItem('${1:key}')" }
		]
	},
	templateStorage: {
		description: 'Returns an object with methods for accessing template storage. Template storage is a mechanism that allows data to persist for the lifetime of the page. Data stored in template storage remains for the current page\'s lifetime. If the page is reloaded or a new page is navigated to, the data is reset.',
		methods: [
			{ name: 'getItem', description: 'Retrieves the value that was stored under the given key. Returns null if no value is stored.', signature: '(key: string) => any', snippet: "templateStorage.getItem('${1:key}')" },
			{ name: 'setItem', description: 'Stores the given value under the given key.', signature: '(key: string, value: any) => void', snippet: "templateStorage.setItem('${1:key}', ${2:value})" },
			{ name: 'removeItem', description: 'Removes the given key from template storage.', signature: '(key: string) => void', snippet: "templateStorage.removeItem('${1:key}')" }
		]
	}
};

// Server-side objects
const GTM_SERVER_OBJECTS: Record<string, GtmObjectDefinition> = {
	BigQuery: {
		description: 'Provides access to BigQuery for data insertion.',
		methods: [
			{
				name: 'insert',
				description: 'Writes data rows into a BigQuery table.',
				signature: '(connectionInfo: object, rows: object[], options?: object) => Promise',
				snippet: "BigQuery.insert({\n\tprojectId: '${1:projectId}',\n\tdatasetId: '${2:datasetId}',\n\ttableId: '${3:tableId}'\n}, [{ $0 }])"
			}
		]
	},
	Firestore: {
		description: 'Provides access to Firestore database operations.',
		methods: [
			{ name: 'read', description: 'Reads a document from Firestore.', signature: '(path: string, options?: object) => Promise<object>', snippet: "Firestore.read('${1:collection/document}')" },
			{ name: 'write', description: 'Writes data to a Firestore document.', signature: '(path: string, input: object, options?: object) => Promise', snippet: "Firestore.write('${1:collection/document}', { $0 })" },
			{ name: 'query', description: 'Queries a Firestore collection.', signature: '(collection: string, conditions: Array, options?: object) => Promise<object[]>', snippet: "Firestore.query('${1:collection}', [])" }
		]
	},
	Promise: {
		description: 'Provides Promise creation and utility methods.',
		methods: [
			{ name: 'create', description: 'Creates a new Promise.', signature: '(resolver: (resolve, reject) => void) => Promise', snippet: 'Promise.create((resolve, reject) => {\n\t$0\n})' },
			{ name: 'all', description: 'Returns a promise that resolves when all input promises resolve.', signature: '(promises: Promise[]) => Promise<any[]>', snippet: 'Promise.all([${1:promises}])' }
		]
	}
};

// Require-based API names
const REQUIRE_BASED_APIS = [
	'addConsentListener', 'addEventCallback', 'aliasInWindow', 'callInWindow', 'callLater',
	'copyFromDataLayer', 'copyFromWindow', 'createArgumentsQueue', 'createQueue',
	'decodeUri', 'decodeUriComponent', 'encodeUri', 'encodeUriComponent', 'fromBase64',
	'generateRandom', 'getContainerVersion', 'getCookieValues', 'getQueryParameters',
	'getReferrerQueryParameters', 'getReferrerUrl', 'getTimestamp', 'getTimestampMillis', 'getType', 'getUrl',
	'gtagSet', 'injectHiddenIframe', 'injectScript', 'isConsentGranted', 'JSON', 'localStorage',
	'logToConsole', 'makeInteger', 'makeNumber', 'makeString', 'makeTableMap', 'Math',
	'Object', 'parseUrl', 'queryPermission', 'readCharacterSet', 'readTitle', 'sendPixel',
	'setCookie', 'setDefaultConsentState', 'setInWindow', 'sha256', 'templateStorage',
	'toBase64', 'updateConsentState'
];

const REQUIRE_BASED_SERVER_APIS = [
	...REQUIRE_BASED_APIS.filter(a => !['aliasInWindow', 'callInWindow', 'copyFromDataLayer', 'copyFromWindow',
		'createArgumentsQueue', 'createQueue', 'getQueryParameters', 'getReferrerQueryParameters',
		'getReferrerUrl', 'getUrl', 'injectHiddenIframe', 'injectScript', 'readCharacterSet',
		'readTitle', 'sendPixel', 'setInWindow'].includes(a)),
	'BigQuery', 'claimRequest', 'computeEffectiveTldPlusOne', 'Firestore', 'getAllEventData',
	'getEventData', 'getRemoteAddress', 'getRequestBody', 'getRequestHeader', 'getRequestMethod',
	'getRequestPath', 'getRequestQueryParameter', 'Promise', 'returnResponse', 'sendHttpGet',
	'sendHttpRequest', 'setPixelResponse', 'setResponseBody', 'setResponseHeader',
	'setResponseStatus', 'sha256Sync'
];

// ============================================================================
// Helper Functions
// ============================================================================

type TemplateType = 'web' | 'server';

function getTemplateType(uri: string): TemplateType {
	if (uri.includes('SANDBOXED_JS_FOR_SERVER')) {
		return 'server';
	}
	return 'web';
}

function isTestFile(uri: string): boolean {
	return uri.includes('TESTS');
}

function isTemplateFile(uri: string): boolean {
	return uri.includes('/templates/');
}

function getAvailableApis(templateType: TemplateType): GtmApiDefinition[] {
	const allApis = [...GTM_SANDBOX_APIS];

	if (templateType === 'server') {
		return [
			...allApis.filter(api => !api.webOnly),
			...GTM_SERVER_APIS
		];
	} else {
		return allApis.filter(api => !api.serverOnly);
	}
}

function getAvailableObjects(templateType: TemplateType): Record<string, GtmObjectDefinition> {
	if (templateType === 'server') {
		return { ...GTM_SANDBOX_OBJECTS, ...GTM_SERVER_OBJECTS };
	}
	return GTM_SANDBOX_OBJECTS;
}

function getRequireBasedApis(templateType: TemplateType): string[] {
	return templateType === 'server' ? REQUIRE_BASED_SERVER_APIS : REQUIRE_BASED_APIS;
}

interface RequireInfo {
	variableName: string;
	apiName: string;
}

function getApiDescription(apiName: string, templateType: TemplateType): string {
	const allApis = [...GTM_SANDBOX_APIS, ...GTM_SERVER_APIS];
	const api = allApis.find(a => a.name === apiName);
	if (api) {
		return api.description;
	}
	const allObjects = { ...GTM_SANDBOX_OBJECTS, ...GTM_SERVER_OBJECTS };
	const obj = allObjects[apiName];
	if (obj) {
		return obj.description;
	}
	return `GTM ${templateType === 'server' ? 'Server' : 'Web'} API`;
}

function findExistingRequires(text: string): RequireInfo[] {
	const requires: RequireInfo[] = [];
	const requireRegex = /(?:const|let|var)\s+(\w+)\s*=\s*require\s*\(\s*['"](\w+)['"]\s*\)/g;
	let match;
	while ((match = requireRegex.exec(text)) !== null) {
		requires.push({
			variableName: match[1],
			apiName: match[2]
		});
	}
	return requires;
}

// ============================================================================
// Language Server Handlers
// ============================================================================

connection.onInitialize((params: InitializeParams): InitializeResult => {
	return {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Incremental,
			completionProvider: {
				resolveProvider: true,
				triggerCharacters: ['.', "'", '"', '(']
			},
			hoverProvider: true,
			signatureHelpProvider: {
				triggerCharacters: ['(', ',']
			}
		}
	};
});

// Completion provider
connection.onCompletion((params: CompletionParams): CompletionItem[] => {
	const document = documents.get(params.textDocument.uri);
	if (!document) return [];

	const uri = params.textDocument.uri;
	const templateType = getTemplateType(uri);
	const isTest = isTestFile(uri);
	const text = document.getText();
	const offset = document.offsetAt(params.position);
	const lineText = document.getText({
		start: { line: params.position.line, character: 0 },
		end: params.position
	});

	const items: CompletionItem[] = [];

	// Check if we're completing inside require() - with or without quotes
	// Matches: require(, require(', require(", require('prefix, require("prefix
	const requireMatch = lineText.match(/require\s*\(\s*(['"]?)(\w*)$/);
	if (requireMatch) {
		const hasQuote = requireMatch[1]; // ' or " or empty
		const prefix = requireMatch[2] || '';
		const requireApis = getRequireBasedApis(templateType);

		for (const apiName of requireApis) {
			if (prefix && !apiName.toLowerCase().startsWith(prefix.toLowerCase())) {
				continue;
			}

			// If no quote yet, insert with quotes; if quote exists, just insert the name
			const insertText = hasQuote ? apiName : `'${apiName}'`;

			const item: CompletionItem = {
				label: apiName,
				kind: CompletionItemKind.Module,
				insertText: insertText,
				detail: getApiDescription(apiName, templateType),
				data: { type: 'require', apiName }
			};
			items.push(item);
		}
		return items;
	}

	// Don't show completions when inside a function call (after opening paren)
	// This allows signature help to work without completion noise
	if (lineText.match(/\w+\s*\(\s*[^)]*$/)) {
		return items; // Return empty - let signature help take over
	}

	// Check if we're completing an object method (e.g., JSON., Math., or custom variable names)
	const objectMethodMatch = lineText.match(/(\w+)\.\s*$/);
	if (objectMethodMatch) {
		const varName = objectMethodMatch[1];
		const objects = getAvailableObjects(templateType);

		// First check if it's a direct object name (JSON, Math, etc.)
		let objectDef = objects[varName];
		let actualObjectName = varName;

		// If not found, check if varName is a variable that maps to an object
		if (!objectDef) {
			const existingRequires = findExistingRequires(text);
			const reqInfo = existingRequires.find(r => r.variableName === varName);
			if (reqInfo && objects[reqInfo.apiName]) {
				objectDef = objects[reqInfo.apiName];
				actualObjectName = reqInfo.apiName;
			}
		}

		if (objectDef) {
			for (const method of objectDef.methods) {
				// Replace the original object name in snippet with the variable name user is using
				const snippetWithoutPrefix = method.snippet.replace(`${actualObjectName}.`, '');
				const item: CompletionItem = {
					label: method.name,
					kind: CompletionItemKind.Method,
					detail: method.signature,
					documentation: method.description,
					insertText: snippetWithoutPrefix,
					insertTextFormat: InsertTextFormat.Snippet,
					data: { type: 'method', objectName: actualObjectName, methodName: method.name }
				};
				items.push(item);
			}
		}
		return items;
	}

	// Get existing requires in the document
	const existingRequires = findExistingRequires(text);

	// Add completions for already-required APIs using their assigned variable names
	const apis = getAvailableApis(templateType);
	const objects = getAvailableObjects(templateType);

	for (const reqInfo of existingRequires) {
		const { variableName, apiName } = reqInfo;

		// Check if it's an API function
		const api = apis.find(a => a.name === apiName);
		if (api) {
			if (api.isTestApi && !isTest) continue;

			// Create snippet using the variable name instead of API name
			const snippetWithVarName = api.snippet
				? api.snippet.replace(new RegExp(`^${apiName}`), variableName)
				: `${variableName}($0)`;

			const item: CompletionItem = {
				label: variableName,
				kind: CompletionItemKind.Function,
				detail: `${apiName}: (${api.parameters.map(p => `${p.name}${p.optional ? '?' : ''}: ${p.type}`).join(', ')}) => ${api.returnType}`,
				documentation: api.description,
				insertText: snippetWithVarName,
				insertTextFormat: InsertTextFormat.Snippet,
				data: { type: 'api', apiName: api.name, variableName }
			};

			if (api.deprecated) {
				item.tags = [1]; // Deprecated tag
			}

			items.push(item);
			continue;
		}

		// Check if it's an object (JSON, Math, etc.)
		const objectDef = objects[apiName];
		if (objectDef) {
			const item: CompletionItem = {
				label: variableName,
				kind: CompletionItemKind.Module,
				detail: `${apiName}: GTM ${templateType === 'server' ? 'Server' : 'Web'} API`,
				data: { type: 'object', objectName: apiName, variableName }
			};
			items.push(item);
		}
	}

	// Add require() completion
	const item: CompletionItem = {
		label: 'require',
		kind: CompletionItemKind.Function,
		detail: 'Import a GTM Sandboxed API',
		insertText: "require('${1:apiName}')",
		insertTextFormat: InsertTextFormat.Snippet,
		documentation: "Import a built-in GTM API function. Use `require('apiName')` to import APIs."
	};
	items.push(item);

	// Add data object completion
	items.push({
		label: 'data',
		kind: CompletionItemKind.Variable,
		detail: 'Template input data',
		documentation: 'The data object containing values from template fields defined in TEMPLATE_PARAMETERS.'
	});

	return items;
});

// Completion resolve
connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
	return item;
});

// Hover provider
connection.onHover((params: TextDocumentPositionParams): Hover | null => {
	const document = documents.get(params.textDocument.uri);
	if (!document) return null;

	const uri = params.textDocument.uri;
	const templateType = getTemplateType(uri);

	// Get the word at the position
	const text = document.getText();
	const offset = document.offsetAt(params.position);

	// Find word boundaries
	let start = offset;
	let end = offset;
	while (start > 0 && /\w/.test(text[start - 1])) start--;
	while (end < text.length && /\w/.test(text[end])) end++;

	const word = text.substring(start, end);
	if (!word) return null;

	// Check if the word is a variable that maps to an API
	const existingRequires = findExistingRequires(text);
	const reqInfo = existingRequires.find(r => r.variableName === word);

	// Determine the API name - either directly or via variable mapping
	const apiName = reqInfo ? reqInfo.apiName : word;
	const displayName = reqInfo ? word : apiName;

	// Check if it's an API name
	const allApis = [...GTM_SANDBOX_APIS, ...GTM_SERVER_APIS];
	const api = allApis.find(a => a.name === apiName);

	if (api) {
		if (api.serverOnly && templateType !== 'server') return null;
		if (api.webOnly && templateType !== 'web') return null;

		const apiParams = api.parameters.map(p => `${p.name}${p.optional ? '?' : ''}: ${p.type}`).join(', ');
		let markdown = `\`\`\`typescript\nfunction ${displayName}(${apiParams}): ${api.returnType}\n\`\`\`\n\n${api.description}`;

		if (reqInfo && reqInfo.variableName !== reqInfo.apiName) {
			markdown += `\n\n*Alias for \`${api.name}\`*`;
		}

		if (api.parameters.length > 0) {
			markdown += '\n\n**Parameters:**\n';
			for (const param of api.parameters) {
				markdown += `- \`${param.name}\`${param.optional ? ' (optional)' : ''}: ${param.type}`;
				if (param.description) {
					markdown += ` — ${param.description}`;
				}
				markdown += '\n';
			}
		}

		markdown += `\n**Returns:** \`${api.returnType}\``;

		if (api.deprecated) {
			markdown += `\n\n⚠️ **Deprecated**: ${api.deprecatedMessage || 'This API is deprecated.'}`;
		}
		if (api.serverOnly) {
			markdown += '\n\n🖥️ *Server-side template only*';
		}
		if (api.webOnly) {
			markdown += '\n\n🌐 *Web template only*';
		}

		if (!reqInfo) {
			markdown += `\n\n*Import with:* \`const ${api.name} = require('${api.name}');\``;
		}

		return {
			contents: {
				kind: MarkupKind.Markdown,
				value: markdown
			}
		};
	}

	// Check if it's an object name
	const allObjects = { ...GTM_SANDBOX_OBJECTS, ...GTM_SERVER_OBJECTS };
	const objectDef = allObjects[apiName];

	if (objectDef) {
		let markdown = `### ${displayName}\n\n${objectDef.description}`;

		if (reqInfo && reqInfo.variableName !== reqInfo.apiName) {
			markdown += `\n\n*Alias for \`${apiName}\`*`;
		}

		markdown += '\n\n**Methods:**\n\n';
		for (const method of objectDef.methods) {
			markdown += `#### ${displayName}.${method.name}\n\`\`\`typescript\n${method.signature}\n\`\`\`\n${method.description}\n\n`;
		}

		if (!reqInfo) {
			markdown += `\n*Import with:* \`const ${apiName} = require('${apiName}');\``;
		}

		return {
			contents: {
				kind: MarkupKind.Markdown,
				value: markdown
			}
		};
	}

	// Check for 'data' object
	if (word === 'data') {
		return {
			contents: {
				kind: MarkupKind.Markdown,
				value: '### data\n\nThe template input data object.\n\nContains values from template fields defined in the `TEMPLATE_PARAMETERS` section.\n\nAccess field values using `data.fieldName` or `data[\'fieldName\']`.'
			}
		};
	}

	return null;
});

// Signature help
connection.onSignatureHelp((params: TextDocumentPositionParams): SignatureHelp | null => {
	const document = documents.get(params.textDocument.uri);
	if (!document) return null;

	const uri = params.textDocument.uri;
	const templateType = getTemplateType(uri);
	const text = document.getText();
	const offset = document.offsetAt(params.position);

	// Find the function call we're in
	const textBeforeCursor = text.substring(0, offset);
	const match = textBeforeCursor.match(/(\w+)\s*\([^)]*$/);
	if (!match) return null;

	const funcName = match[1];

	// Check if funcName is a variable that maps to an API
	const existingRequires = findExistingRequires(text);
	const reqInfo = existingRequires.find(r => r.variableName === funcName);
	const apiName = reqInfo ? reqInfo.apiName : funcName;
	const displayName = reqInfo ? funcName : apiName;

	// Find the API
	const allApis = [...GTM_SANDBOX_APIS, ...GTM_SERVER_APIS];
	const api = allApis.find(a => a.name === apiName);
	if (!api) return null;
	if (api.serverOnly && templateType !== 'server') return null;
	if (api.webOnly && templateType !== 'web') return null;

	// Count commas to determine active parameter
	const argsText = textBeforeCursor.substring(match.index! + match[0].indexOf('(') + 1);
	let activeParameter = 0;
	let depth = 0;
	for (const char of argsText) {
		if (char === '(' || char === '[' || char === '{') depth++;
		else if (char === ')' || char === ']' || char === '}') depth--;
		else if (char === ',' && depth === 0) activeParameter++;
	}

	const parameterInfos: ParameterInformation[] = api.parameters.map(p => ({
		label: `${p.name}${p.optional ? '?' : ''}: ${p.type}`,
		documentation: p.description
	}));

	// Use the display name (variable name) in the signature, not the API name
	const signature: SignatureInformation = {
		label: `${displayName}(${api.parameters.map(p => `${p.name}${p.optional ? '?' : ''}: ${p.type}`).join(', ')}): ${api.returnType}`,
		documentation: api.description,
		parameters: parameterInfos
	};

	return {
		signatures: [signature],
		activeSignature: 0,
		activeParameter: Math.min(activeParameter, api.parameters.length - 1)
	};
});

// Document validation (diagnostics)
documents.onDidChangeContent(change => {
	validateDocument(change.document);
});

async function validateDocument(document: TextDocument): Promise<void> {
	const uri = document.uri;

	// Only validate gtmsense documents
	if (!uri.includes('gtmsense')) return;

	// Skip template files from ES5 checks
	if (isTemplateFile(uri)) {
		connection.sendDiagnostics({ uri, diagnostics: [] });
		return;
	}

	const text = document.getText();
	const diagnostics: Diagnostic[] = [];

	// ES5 patterns for tags/variables (not templates)
	const es6Patterns = [
		{ pattern: /\([^)]*\)\s*=>/g, message: 'Arrow functions are ES6+. GTM requires ES5. Use "function() {}" instead.' },
		{ pattern: /\w+\s*=>/g, message: 'Arrow functions are ES6+. GTM requires ES5. Use "function() {}" instead.' },
		{ pattern: /\blet\s+\w+/g, message: '"let" is ES6+. GTM requires ES5. Use "var" instead.' },
		{ pattern: /\bconst\s+\w+/g, message: '"const" is ES6+. GTM requires ES5. Use "var" instead.' },
		{ pattern: /`[^`]*`/g, message: 'Template literals are ES6+. GTM requires ES5. Use string concatenation instead.' },
		{ pattern: /\bclass\s+\w+/g, message: 'Classes are ES6+. GTM requires ES5. Use constructor functions instead.' },
		{ pattern: /\.includes\s*\(/g, message: 'Array/String.includes() is ES6+. GTM requires ES5. Use indexOf() !== -1.' },
		{ pattern: /\.find\s*\(/g, message: 'Array.find() is ES6+. GTM requires ES5. Use a for loop or filter()[0].' }
	];

	for (const { pattern, message } of es6Patterns) {
		pattern.lastIndex = 0;
		let match;
		while ((match = pattern.exec(text)) !== null) {
			const startPos = document.positionAt(match.index);
			const endPos = document.positionAt(match.index + match[0].length);
			diagnostics.push({
				severity: DiagnosticSeverity.Error,
				range: { start: startPos, end: endPos },
				message,
				source: 'GTM ES5'
			});
		}
	}

	connection.sendDiagnostics({ uri, diagnostics });
}

// Start listening
documents.listen(connection);
connection.listen();
