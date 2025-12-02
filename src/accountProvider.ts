import * as vscode from 'vscode';
import { getAuthenticatedEmail } from './auth';

type AccountItemType = 'account' | 'signout';

export class AccountTreeItem extends vscode.TreeItem {
	constructor(
		public readonly label: string,
		public readonly itemType: AccountItemType,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState,
		public readonly email?: string
	) {
		super(label, collapsibleState);

		this.contextValue = itemType;

		switch (itemType) {
			case 'account':
				this.iconPath = new vscode.ThemeIcon('account');
				this.description = email;
				break;
			case 'signout':
				this.iconPath = new vscode.ThemeIcon('sign-out');
				this.command = {
					command: 'gtmsense.signOut',
					title: 'Sign Out'
				};
				break;
		}
	}
}

export class GtmAccountProvider implements vscode.TreeDataProvider<AccountTreeItem> {
	private _onDidChangeTreeData = new vscode.EventEmitter<AccountTreeItem | undefined>();
	readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

	refresh(): void {
		this._onDidChangeTreeData.fire(undefined);
	}

	getTreeItem(element: AccountTreeItem): vscode.TreeItem {
		return element;
	}

	async getChildren(): Promise<AccountTreeItem[]> {
		const email = await getAuthenticatedEmail();

		if (!email) {
			// Not logged in - show nothing
			return [];
		}

		// Logged in - show account info and sign out
		return [
			new AccountTreeItem('Signed in as', 'account', vscode.TreeItemCollapsibleState.None, email),
			new AccountTreeItem('Sign Out', 'signout', vscode.TreeItemCollapsibleState.None)
		];
	}
}
