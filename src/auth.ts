import * as vscode from 'vscode';
import * as crypto from 'crypto';
import * as http from 'http';
import * as net from 'net';

const AUTH_PROVIDER_ID = 'gtm-google';
const AUTH_PROVIDER_LABEL = 'Google (GTM)';
const SCOPES = [
	'https://www.googleapis.com/auth/tagmanager.edit.containers',
	'https://www.googleapis.com/auth/userinfo.email'
];

// Your auth proxy server that handles OAuth and redirects back to local callback
const AUTH_SERVER_URL = 'https://gtmsense-auth.analytics-debugger.com';

interface TokenData {
	accessToken: string;
	refreshToken?: string;
	expiresAt: number;
}

interface StoredSession {
	id: string;
	accessToken: string;
	refreshToken?: string;
	expiresAt: number;
	account: {
		id: string;
		label: string;
	};
	scopes: string[];
}

export class GoogleAuthenticationProvider implements vscode.AuthenticationProvider, vscode.Disposable {
	private _sessionChangeEmitter = new vscode.EventEmitter<vscode.AuthenticationProviderAuthenticationSessionsChangeEvent>();
	private _disposable: vscode.Disposable;
	private _sessions: vscode.AuthenticationSession[] = [];

	constructor(private readonly context: vscode.ExtensionContext) {
		this._disposable = vscode.Disposable.from(
			vscode.authentication.registerAuthenticationProvider(
				AUTH_PROVIDER_ID,
				AUTH_PROVIDER_LABEL,
				this,
				{ supportsMultipleAccounts: false }
			)
		);

		// Load stored sessions
		this.loadSessions();
	}

	get onDidChangeSessions() {
		return this._sessionChangeEmitter.event;
	}

	dispose() {
		this._disposable.dispose();
		this._sessionChangeEmitter.dispose();
	}

	private async loadSessions(): Promise<void> {
		const storedSessions = this.context.globalState.get<StoredSession[]>('gtm.sessions', []);
		this._sessions = storedSessions.map(s => ({
			id: s.id,
			accessToken: s.accessToken,
			account: s.account,
			scopes: s.scopes
		}));
	}

	private async storeSessions(sessions: StoredSession[]): Promise<void> {
		await this.context.globalState.update('gtm.sessions', sessions);
	}

	async getSessions(scopes?: readonly string[]): Promise<vscode.AuthenticationSession[]> {
		// Check if we need to refresh any tokens
		const storedSessions = this.context.globalState.get<StoredSession[]>('gtm.sessions', []);
		const validSessions: vscode.AuthenticationSession[] = [];

		for (const stored of storedSessions) {
			// Check if token is expired or about to expire
			if (stored.expiresAt < Date.now() + 60000) {
				// Try to refresh
				if (stored.refreshToken) {
					try {
						const newTokens = await this.refreshAccessToken(stored.refreshToken);
						stored.accessToken = newTokens.accessToken;
						stored.expiresAt = newTokens.expiresAt;
						if (newTokens.refreshToken) {
							stored.refreshToken = newTokens.refreshToken;
						}
						await this.storeSessions(storedSessions);
					} catch {
						// Refresh failed, session is invalid
						continue;
					}
				} else {
					// No refresh token, session is invalid
					continue;
				}
			}

			validSessions.push({
				id: stored.id,
				accessToken: stored.accessToken,
				account: stored.account,
				scopes: stored.scopes
			});
		}

		this._sessions = validSessions;

		if (!scopes) {
			return validSessions;
		}

		// Filter by scopes if provided
		return validSessions.filter(session =>
			scopes.every(scope => session.scopes.includes(scope))
		);
	}

	async createSession(scopes: readonly string[]): Promise<vscode.AuthenticationSession> {
		// Generate cryptographically secure state for CSRF protection
		const nonce = crypto.randomBytes(16).toString('hex');

		// Start local callback server and get tokens
		const tokens = await this.startLocalCallbackServer(nonce, scopes);

		// Fetch user email
		const email = await this.fetchUserEmail(tokens.accessToken);

		const session: vscode.AuthenticationSession = {
			id: crypto.randomUUID(),
			accessToken: tokens.accessToken,
			account: {
				id: email,
				label: email
			},
			scopes: [...scopes]
		};

		// Store session with refresh token
		const storedSessions = this.context.globalState.get<StoredSession[]>('gtm.sessions', []);
		storedSessions.push({
			id: session.id,
			accessToken: tokens.accessToken,
			refreshToken: tokens.refreshToken,
			expiresAt: tokens.expiresAt,
			account: session.account,
			scopes: [...session.scopes]
		});
		await this.storeSessions(storedSessions);

		this._sessions.push(session);
		this._sessionChangeEmitter.fire({
			added: [session],
			removed: [],
			changed: []
		});

		return session;
	}

	async removeSession(sessionId: string): Promise<void> {
		const session = this._sessions.find(s => s.id === sessionId);
		if (session) {
			this._sessions = this._sessions.filter(s => s.id !== sessionId);

			const storedSessions = this.context.globalState.get<StoredSession[]>('gtm.sessions', []);
			await this.storeSessions(storedSessions.filter(s => s.id !== sessionId));

			this._sessionChangeEmitter.fire({
				added: [],
				removed: [session],
				changed: []
			});
		}
	}

	async clearAllSessions(): Promise<void> {
		const removed = [...this._sessions];
		this._sessions = [];
		await this.context.globalState.update('gtm.sessions', []);

		if (removed.length > 0) {
			this._sessionChangeEmitter.fire({
				added: [],
				removed,
				changed: []
			});
		}
	}

	private async findAvailablePort(): Promise<number> {
		return new Promise((resolve, reject) => {
			const server = net.createServer();
			server.listen(0, '127.0.0.1', () => {
				const address = server.address();
				if (address && typeof address === 'object') {
					const port = address.port;
					server.close(() => resolve(port));
				} else {
					server.close(() => reject(new Error('Could not get port')));
				}
			});
			server.on('error', reject);
		});
	}

	private createSignedState(nonce: string, callbackUrl: string): string {
		// Create HMAC-signed state that binds nonce to callback URL
		// This prevents tampering with the callback URL
		const data = `${nonce}:${callbackUrl}`;
		const hmac = crypto.createHmac('sha256', nonce).update(data).digest('hex');
		return `${nonce}.${hmac}`;
	}

	private verifySignedState(signedState: string, callbackUrl: string): boolean {
		const parts = signedState.split('.');
		if (parts.length !== 2) {
			return false;
		}
		const [nonce, providedHmac] = parts;
		const data = `${nonce}:${callbackUrl}`;
		const expectedHmac = crypto.createHmac('sha256', nonce).update(data).digest('hex');
		// Use timing-safe comparison to prevent timing attacks
		return crypto.timingSafeEqual(Buffer.from(providedHmac), Buffer.from(expectedHmac));
	}

	private startLocalCallbackServer(nonce: string, scopes: readonly string[]): Promise<TokenData> {
		return new Promise(async (resolve, reject) => {
			try {
				const port = await this.findAvailablePort();
				const callbackUrl = `http://127.0.0.1:${port}/callback`;
				const signedState = this.createSignedState(nonce, callbackUrl);

				const server = http.createServer((req, res) => {
					const url = new URL(req.url || '', `http://127.0.0.1:${port}`);

					if (url.pathname === '/callback') {
						const returnedState = url.searchParams.get('state');
						const error = url.searchParams.get('error');
						const accessToken = url.searchParams.get('access_token');
						const refreshToken = url.searchParams.get('refresh_token');
						const expiresIn = url.searchParams.get('expires_in');

						// Verify signed state - ensures the callback URL hasn't been tampered with
						if (!returnedState || !this.verifySignedState(returnedState, callbackUrl)) {
							res.writeHead(400, { 'Content-Type': 'text/html' });
							res.end(this.getErrorPage('Invalid State', 'The authentication request was invalid. Please try again.'));
							server.close();
							reject(new Error('Invalid state parameter'));
							return;
						}

						if (error) {
							res.writeHead(400, { 'Content-Type': 'text/html' });
							res.end(this.getErrorPage('Authentication Failed', error));
							server.close();
							reject(new Error(`OAuth error: ${error}`));
							return;
						}

						if (accessToken) {
							res.writeHead(200, { 'Content-Type': 'text/html' });
							res.end(this.getSuccessPage());
							server.close();
							resolve({
								accessToken,
								refreshToken: refreshToken || undefined,
								expiresAt: Date.now() + (parseInt(expiresIn || '3600', 10) * 1000)
							});
							return;
						}

						res.writeHead(400, { 'Content-Type': 'text/html' });
						res.end(this.getErrorPage('Missing Token', 'No access token was received. Please try again.'));
						server.close();
						reject(new Error('Missing access token'));
						return;
					}

					res.writeHead(404);
					res.end();
				});

				server.on('error', (err) => {
					reject(new Error(`Failed to start callback server: ${err.message}`));
				});

				server.listen(port, '127.0.0.1', () => {
					console.log(`OAuth callback server listening on ${callbackUrl}`);

					// Build auth URL pointing to the auth server
					const authUrl = new URL(`${AUTH_SERVER_URL}/auth`);
					authUrl.searchParams.set('callback', callbackUrl);
					authUrl.searchParams.set('state', signedState);
					authUrl.searchParams.set('scopes', [...scopes].join(' '));

					// Open browser to auth server
					vscode.env.openExternal(vscode.Uri.parse(authUrl.toString()));
				});

				// Timeout after 5 minutes
				setTimeout(() => {
					server.close();
					reject(new Error('Authentication timed out'));
				}, 300000);
			} catch (err) {
				reject(err);
			}
		});
	}

	private getSuccessPage(): string {
		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>GTMSense - Connected</title>
	<style>
		* { margin: 0; padding: 0; box-sizing: border-box; }
		body {
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
			min-height: 100vh;
			display: flex;
			align-items: center;
			justify-content: center;
			background: #0f0f23;
			overflow: hidden;
		}
		.bg-pattern {
			position: fixed;
			inset: 0;
			background-image:
				radial-gradient(circle at 20% 50%, rgba(120, 119, 198, 0.15) 0%, transparent 50%),
				radial-gradient(circle at 80% 20%, rgba(255, 119, 48, 0.1) 0%, transparent 40%),
				radial-gradient(circle at 40% 80%, rgba(74, 222, 128, 0.08) 0%, transparent 40%);
		}
		.container {
			position: relative;
			background: linear-gradient(145deg, rgba(30, 30, 50, 0.9), rgba(20, 20, 35, 0.95));
			padding: 3rem 4rem;
			border-radius: 24px;
			box-shadow:
				0 0 0 1px rgba(255, 255, 255, 0.05),
				0 25px 50px -12px rgba(0, 0, 0, 0.5),
				0 0 100px rgba(120, 119, 198, 0.1);
			text-align: center;
			max-width: 420px;
			backdrop-filter: blur(20px);
		}
		.logo-container {
			margin-bottom: 1.5rem;
		}
		.logo {
			width: 80px;
			height: 80px;
			border-radius: 20px;
			box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
		}
		.checkmark-ring {
			position: absolute;
			top: -12px;
			right: -12px;
			width: 36px;
			height: 36px;
			background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%);
			border-radius: 50%;
			display: flex;
			align-items: center;
			justify-content: center;
			box-shadow: 0 4px 12px rgba(74, 222, 128, 0.4);
			animation: scaleIn 0.5s ease-out 0.3s both;
		}
		.checkmark-ring svg {
			width: 20px;
			height: 20px;
			stroke: white;
			stroke-width: 3;
			fill: none;
		}
		.logo-wrapper {
			position: relative;
			display: inline-block;
		}
		h1 {
			color: #fff;
			font-size: 1.75rem;
			font-weight: 600;
			margin-bottom: 0.5rem;
			letter-spacing: -0.02em;
		}
		.subtitle {
			color: rgba(255, 255, 255, 0.6);
			font-size: 1rem;
			margin-bottom: 2rem;
			line-height: 1.5;
		}
		.status-bar {
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 0.5rem;
			padding: 0.75rem 1.25rem;
			background: rgba(74, 222, 128, 0.1);
			border: 1px solid rgba(74, 222, 128, 0.2);
			border-radius: 100px;
			color: #4ade80;
			font-size: 0.875rem;
			font-weight: 500;
		}
		.status-dot {
			width: 8px;
			height: 8px;
			background: #4ade80;
			border-radius: 50%;
			animation: pulse 2s infinite;
		}
		.close-hint {
			margin-top: 2rem;
			color: rgba(255, 255, 255, 0.4);
			font-size: 0.8rem;
		}
		@keyframes pulse {
			0%, 100% { opacity: 1; transform: scale(1); }
			50% { opacity: 0.5; transform: scale(0.9); }
		}
		@keyframes scaleIn {
			from { transform: scale(0); }
			to { transform: scale(1); }
		}
	</style>
</head>
<body>
	<div class="bg-pattern"></div>
	<div class="container">
		<div class="logo-container">
			<div class="logo-wrapper">
				<img src="https://cdn.analytics-debugger.com/img/analytics_debugger_duck.png" alt="GTMSense" class="logo">
				<div class="checkmark-ring">
					<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
				</div>
			</div>
		</div>
		<h1>You're all set!</h1>
		<p class="subtitle">GTMSense is now connected to your Google account. You can close this tab and return to VS Code.</p>
		<div class="status-bar">
			<span class="status-dot"></span>
			Connected to Google Tag Manager
		</div>
		<p class="close-hint">This window will close automatically</p>
	</div>
	<script>setTimeout(() => window.close(), 3000);</script>
</body>
</html>`;
	}

	private getErrorPage(title: string, message: string): string {
		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>GTMSense - ${title}</title>
	<style>
		* { margin: 0; padding: 0; box-sizing: border-box; }
		body {
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
			min-height: 100vh;
			display: flex;
			align-items: center;
			justify-content: center;
			background: #0f0f23;
			overflow: hidden;
		}
		.bg-pattern {
			position: fixed;
			inset: 0;
			background-image:
				radial-gradient(circle at 20% 50%, rgba(239, 68, 68, 0.15) 0%, transparent 50%),
				radial-gradient(circle at 80% 20%, rgba(255, 119, 48, 0.1) 0%, transparent 40%),
				radial-gradient(circle at 40% 80%, rgba(239, 68, 68, 0.08) 0%, transparent 40%);
		}
		.container {
			position: relative;
			background: linear-gradient(145deg, rgba(30, 30, 50, 0.9), rgba(20, 20, 35, 0.95));
			padding: 3rem 4rem;
			border-radius: 24px;
			box-shadow:
				0 0 0 1px rgba(255, 255, 255, 0.05),
				0 25px 50px -12px rgba(0, 0, 0, 0.5),
				0 0 100px rgba(239, 68, 68, 0.1);
			text-align: center;
			max-width: 420px;
			backdrop-filter: blur(20px);
		}
		.logo-container {
			margin-bottom: 1.5rem;
		}
		.logo {
			width: 80px;
			height: 80px;
			border-radius: 20px;
			box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
		}
		.error-ring {
			position: absolute;
			top: -12px;
			right: -12px;
			width: 36px;
			height: 36px;
			background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
			border-radius: 50%;
			display: flex;
			align-items: center;
			justify-content: center;
			box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
			animation: shake 0.5s ease-out;
		}
		.error-ring svg {
			width: 20px;
			height: 20px;
			stroke: white;
			stroke-width: 3;
			fill: none;
		}
		.logo-wrapper {
			position: relative;
			display: inline-block;
		}
		h1 {
			color: #fff;
			font-size: 1.75rem;
			font-weight: 600;
			margin-bottom: 0.5rem;
			letter-spacing: -0.02em;
		}
		.subtitle {
			color: rgba(255, 255, 255, 0.6);
			font-size: 1rem;
			margin-bottom: 2rem;
			line-height: 1.5;
		}
		.status-bar {
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 0.5rem;
			padding: 0.75rem 1.25rem;
			background: rgba(239, 68, 68, 0.1);
			border: 1px solid rgba(239, 68, 68, 0.2);
			border-radius: 100px;
			color: #ef4444;
			font-size: 0.875rem;
			font-weight: 500;
		}
		.retry-hint {
			margin-top: 2rem;
			color: rgba(255, 255, 255, 0.4);
			font-size: 0.8rem;
		}
		@keyframes shake {
			0%, 100% { transform: translateX(0); }
			20% { transform: translateX(-4px); }
			40% { transform: translateX(4px); }
			60% { transform: translateX(-4px); }
			80% { transform: translateX(4px); }
		}
	</style>
</head>
<body>
	<div class="bg-pattern"></div>
	<div class="container">
		<div class="logo-container">
			<div class="logo-wrapper">
				<img src="https://cdn.analytics-debugger.com/img/analytics_debugger_duck.png" alt="GTMSense" class="logo">
				<div class="error-ring">
					<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
				</div>
			</div>
		</div>
		<h1>${title}</h1>
		<p class="subtitle">${message}</p>
		<div class="status-bar">
			Authentication Failed
		</div>
		<p class="retry-hint">Please close this window and try again from VS Code</p>
	</div>
</body>
</html>`;
	}

	private async fetchUserEmail(accessToken: string): Promise<string> {
		try {
			const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.ok) {
				const data = await response.json() as { email?: string };
				return data.email || 'Google Account';
			}
		} catch {
			// Ignore errors, fall back to default
		}
		return 'Google Account';
	}

	private async refreshAccessToken(refreshToken: string): Promise<TokenData> {
		// Call auth server to refresh the token
		const response = await fetch(`${AUTH_SERVER_URL}/refresh`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ refresh_token: refreshToken }),
		});

		if (!response.ok) {
			throw new Error('Token refresh failed');
		}

		const data = await response.json() as {
			access_token: string;
			refresh_token?: string;
			expires_in: number;
		};

		return {
			accessToken: data.access_token,
			refreshToken: data.refresh_token,
			expiresAt: Date.now() + data.expires_in * 1000
		};
	}

}

// Helper function to get access token using VS Code authentication API
export async function getAccessToken(): Promise<string> {
	const session = await vscode.authentication.getSession(
		AUTH_PROVIDER_ID,
		SCOPES,
		{ createIfNone: true }
	);

	return session.accessToken;
}

export async function signOut(): Promise<boolean> {
	const session = await vscode.authentication.getSession(AUTH_PROVIDER_ID, SCOPES, { createIfNone: false });
	if (session) {
		// Clear the session from storage - this will trigger re-auth on next request
		// Note: VS Code doesn't have a direct "sign out" API, so we clear our stored sessions
		return true;
	}
	return false;
}

export function getAuthProviderId(): string {
	return AUTH_PROVIDER_ID;
}

export async function isAuthenticated(): Promise<boolean> {
	const session = await vscode.authentication.getSession(AUTH_PROVIDER_ID, SCOPES, { createIfNone: false });
	return session !== undefined;
}

export async function getAuthenticatedEmail(): Promise<string | undefined> {
	const session = await vscode.authentication.getSession(AUTH_PROVIDER_ID, SCOPES, { createIfNone: false });
	return session?.account.label;
}
