import * as path from 'path';
import * as vscode from 'vscode';
import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind
} from 'vscode-languageclient/node';

let client: LanguageClient | undefined;

export function activateLanguageClient(context: vscode.ExtensionContext): void {
	// The server is implemented in node
	const serverModule = context.asAbsolutePath(
		path.join('server', 'out', 'server.js')
	);

	// Debug options for the server
	const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

	// Server options - run the server
	const serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc },
		debug: {
			module: serverModule,
			transport: TransportKind.ipc,
			options: debugOptions
		}
	};

	// Options to control the language client
	const clientOptions: LanguageClientOptions = {
		// Register the server for gtmsense scheme documents with gtm-javascript language
		// The gtm-javascript language has its own grammar (not inheriting from source.js)
		// which prevents VSCode's built-in JS IntelliSense from providing completions
		documentSelector: [
			{ scheme: 'gtmsense', language: 'gtm-javascript' }
		],
		synchronize: {
			// Notify the server about file changes
			fileEvents: vscode.workspace.createFileSystemWatcher('**/*.js')
		}
	};

	// Create the language client and start it
	client = new LanguageClient(
		'gtmSenseLanguageServer',
		'GTMSense Language Server',
		serverOptions,
		clientOptions
	);

	// Start the client (also launches the server)
	client.start();
}

export function deactivateLanguageClient(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}
