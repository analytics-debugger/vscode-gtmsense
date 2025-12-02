# GTMSense

[![Visual Studio Marketplace](https://img.shields.io/visual-studio-marketplace/v/analytics-debugger.gtmsense)](https://marketplace.visualstudio.com/items?itemName=analytics-debugger.gtmsense)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Edit Google Tag Manager Custom HTML tags and JavaScript variables directly in VS Code.

## Features

- **Load GTM Containers** - Connect to your Google Tag Manager account and load any container
- **Workspace Support** - Work with different workspaces, including the ability to create new ones
- **Edit Tags & Variables** - Edit Custom HTML tags and Custom JavaScript variables with full VS Code editing capabilities
- **Syntax Highlighting** - GTM-specific JavaScript syntax highlighting
- **IntelliSense** - Autocomplete for GTM's built-in variables and methods
- **Change Tracking** - Visual indicators for modified files with badge counts
- **Push Changes** - Push your changes back to GTM with a single command
- **Discard Changes** - Easily discard changes at file or container level

## Installation

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
3. Search for "GTMSense"
4. Click Install

Or install from the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=analytics-debugger.gtmsense).

## Usage

1. Click the GTMSense icon in the Activity Bar to open the sidebar
2. Click **Load Container** to authenticate with your Google account
3. Select a GTM account, container, and workspace
4. Browse and edit your Custom HTML tags and Custom JavaScript variables
5. Modified files are marked with a dot indicator
6. Use **Push Changes** to save your changes back to GTM

## Commands

| Command | Description |
|---------|-------------|
| `GTM-SENSE: Load Container` | Load a GTM container and workspace |
| `GTM-SENSE: Unload Container` | Unload a container from the sidebar |
| `GTM-SENSE: Create Custom HTML Tag` | Create a new Custom HTML tag |
| `GTM-SENSE: Create Custom JavaScript Variable` | Create a new Custom JavaScript variable |
| `GTM-SENSE: Push Changes` | Push all pending changes to GTM |
| `GTM-SENSE: Discard Changes` | Discard all pending changes |
| `GTM-SENSE: Sign Out` | Sign out of your Google account |

## Requirements

- Visual Studio Code 1.106.0 or higher
- A Google Tag Manager account with edit permissions
- Internet connection for GTM API access

## Privacy & Security

GTMSense uses OAuth 2.0 to authenticate with Google. Your credentials are never stored by the extension - only OAuth tokens are kept locally in VS Code's secure storage. The extension only requests the minimum permissions needed to read and write GTM container data.

## Support

- [Report Issues](https://github.com/analytics-debugger/vscode-gtmsense/issues)
- [Community Forum](https://community.analytics-debugger.com)

## License

[MIT](LICENSE)
