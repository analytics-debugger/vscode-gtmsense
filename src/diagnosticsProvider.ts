import * as vscode from 'vscode';

// ES6+ patterns that should trigger warnings in GTM
const ES6_PATTERNS: Array<{ pattern: RegExp; message: string; severity: vscode.DiagnosticSeverity }> = [
	// Arrow functions
	{
		pattern: /\([^)]*\)\s*=>/g,
		message: 'Arrow functions are ES6+. GTM requires ES5. Use "function() {}" instead.',
		severity: vscode.DiagnosticSeverity.Error,
	},
	{
		pattern: /\w+\s*=>/g,
		message: 'Arrow functions are ES6+. GTM requires ES5. Use "function() {}" instead.',
		severity: vscode.DiagnosticSeverity.Error,
	},
	// let and const
	{
		pattern: /\blet\s+\w+/g,
		message: '"let" is ES6+. GTM requires ES5. Use "var" instead.',
		severity: vscode.DiagnosticSeverity.Error,
	},
	{
		pattern: /\bconst\s+\w+/g,
		message: '"const" is ES6+. GTM requires ES5. Use "var" instead.',
		severity: vscode.DiagnosticSeverity.Error,
	},
	// Template literals
	{
		pattern: /`[^`]*`/g,
		message: 'Template literals are ES6+. GTM requires ES5. Use string concatenation instead.',
		severity: vscode.DiagnosticSeverity.Error,
	},
	// Destructuring assignment
	{
		pattern: /(?:var|let|const)\s*\{[^}]+\}\s*=/g,
		message: 'Object destructuring is ES6+. GTM requires ES5.',
		severity: vscode.DiagnosticSeverity.Error,
	},
	{
		pattern: /(?:var|let|const)\s*\[[^\]]+\]\s*=/g,
		message: 'Array destructuring is ES6+. GTM requires ES5.',
		severity: vscode.DiagnosticSeverity.Error,
	},
	// Spread operator
	{
		pattern: /\.\.\.(?:\w+|\[|\{)/g,
		message: 'Spread operator is ES6+. GTM requires ES5.',
		severity: vscode.DiagnosticSeverity.Error,
	},
	// Default parameters
	{
		pattern: /function\s*\w*\s*\([^)]*=\s*[^)]+\)/g,
		message: 'Default parameters are ES6+. GTM requires ES5.',
		severity: vscode.DiagnosticSeverity.Error,
	},
	// Classes
	{
		pattern: /\bclass\s+\w+/g,
		message: 'Classes are ES6+. GTM requires ES5. Use constructor functions instead.',
		severity: vscode.DiagnosticSeverity.Error,
	},
	// for...of
	{
		pattern: /\bfor\s*\([^)]+\s+of\s+[^)]+\)/g,
		message: '"for...of" is ES6+. GTM requires ES5. Use "for" or "for...in" instead.',
		severity: vscode.DiagnosticSeverity.Error,
	},
	// Promises
	{
		pattern: /\bnew\s+Promise\b/g,
		message: 'Promises are ES6+. GTM requires ES5.',
		severity: vscode.DiagnosticSeverity.Warning,
	},
	{
		pattern: /\.then\s*\(/g,
		message: 'Promises (.then) are ES6+. GTM requires ES5.',
		severity: vscode.DiagnosticSeverity.Warning,
	},
	// async/await
	{
		pattern: /\basync\s+function\b/g,
		message: 'async/await is ES2017+. GTM requires ES5.',
		severity: vscode.DiagnosticSeverity.Error,
	},
	{
		pattern: /\bawait\s+/g,
		message: 'async/await is ES2017+. GTM requires ES5.',
		severity: vscode.DiagnosticSeverity.Error,
	},
	// Object shorthand
	{
		pattern: /\{\s*\w+\s*,/g,
		message: 'Object property shorthand may be ES6+. Ensure you use "key: value" syntax.',
		severity: vscode.DiagnosticSeverity.Hint,
	},
	// Symbol
	{
		pattern: /\bSymbol\s*\(/g,
		message: 'Symbol is ES6+. GTM requires ES5.',
		severity: vscode.DiagnosticSeverity.Error,
	},
	// Map/Set
	{
		pattern: /\bnew\s+Map\s*\(/g,
		message: 'Map is ES6+. GTM requires ES5. Use plain objects instead.',
		severity: vscode.DiagnosticSeverity.Error,
	},
	{
		pattern: /\bnew\s+Set\s*\(/g,
		message: 'Set is ES6+. GTM requires ES5. Use arrays instead.',
		severity: vscode.DiagnosticSeverity.Error,
	},
	// Array methods (some ES5, some ES6+)
	{
		pattern: /\.find\s*\(/g,
		message: 'Array.find() is ES6+. GTM requires ES5. Use a for loop or filter()[0].',
		severity: vscode.DiagnosticSeverity.Error,
	},
	{
		pattern: /\.findIndex\s*\(/g,
		message: 'Array.findIndex() is ES6+. GTM requires ES5. Use a for loop.',
		severity: vscode.DiagnosticSeverity.Error,
	},
	{
		pattern: /\.includes\s*\(/g,
		message: 'Array/String.includes() is ES6+. GTM requires ES5. Use indexOf() !== -1.',
		severity: vscode.DiagnosticSeverity.Error,
	},
	{
		pattern: /Array\.from\s*\(/g,
		message: 'Array.from() is ES6+. GTM requires ES5.',
		severity: vscode.DiagnosticSeverity.Error,
	},
	{
		pattern: /Object\.assign\s*\(/g,
		message: 'Object.assign() is ES6+. GTM requires ES5.',
		severity: vscode.DiagnosticSeverity.Error,
	},
	{
		pattern: /Object\.keys\s*\(/g,
		message: 'Object.keys() is ES5 but may not work in older browsers. Consider compatibility.',
		severity: vscode.DiagnosticSeverity.Hint,
	},
];

export class GtmDiagnosticsProvider {
	private diagnosticCollection: vscode.DiagnosticCollection;

	constructor() {
		this.diagnosticCollection = vscode.languages.createDiagnosticCollection('gtmsense');
	}

	public updateDiagnostics(document: vscode.TextDocument): void {
		if (document.uri.scheme !== 'gtmsense') {
			return;
		}

		const diagnostics: vscode.Diagnostic[] = [];
		const text = document.getText();

		for (const { pattern, message, severity } of ES6_PATTERNS) {
			// Reset regex lastIndex
			pattern.lastIndex = 0;

			let match;
			while ((match = pattern.exec(text)) !== null) {
				const startPos = document.positionAt(match.index);
				const endPos = document.positionAt(match.index + match[0].length);
				const range = new vscode.Range(startPos, endPos);

				const diagnostic = new vscode.Diagnostic(range, message, severity);
				diagnostic.source = 'GTM ES5';
				diagnostics.push(diagnostic);
			}
		}

		this.diagnosticCollection.set(document.uri, diagnostics);
	}

	public clearDiagnostics(document: vscode.TextDocument): void {
		this.diagnosticCollection.delete(document.uri);
	}

	public dispose(): void {
		this.diagnosticCollection.dispose();
	}
}
