# GTMSense

[![Visual Studio Marketplace](https://img.shields.io/visual-studio-marketplace/v/analytics-debugger.gtmsense)](https://marketplace.visualstudio.com/items?itemName=analytics-debugger.gtmsense)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Edit Google Tag Manager Custom HTML tags, JavaScript variables, and Custom Templates directly in VS Code.

## Features

- **Load GTM Containers** - Connect to your Google Tag Manager account and load any container (Web and Server)
- **Workspace Support** - Work with different workspaces, create new ones, and reload to sync with GTM
- **Edit Tags & Variables** - Edit Custom HTML tags and Custom JavaScript variables with full VS Code editing capabilities
- **Custom Templates** - Full support for GTM Custom Templates
  - Edit template sections (JavaScript, Parameters, Info, Permissions, Tests)
  - Create new Tag and Variable templates
  - Auto-detect required permissions from your code
- **Syntax Highlighting** - GTM-specific JavaScript syntax highlighting
- **IntelliSense** - Autocomplete for GTM's built-in variables and methods
- **Change Tracking** - Visual indicators for modified files with badge counts
- **Push Changes** - Push your changes back to GTM with a single command
- **Discard Changes** - Easily discard changes at file or container level

## Supported Container Types

| Type | Status |
|------|--------|
| Web | ✅ Fully supported |
| Server | ✅ Fully supported |
| Android | ❌ Not supported |
| iOS | ❌ Not supported |

## Installation

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
3. Search for "GTMSense"
4. Click Install

Or install from the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=analytics-debugger.gtmsense).

## Usage

1. Click the GTMSense icon in the Activity Bar to open the sidebar
2. Click **Sign In** to authenticate with your Google account
3. Click **Load Container** and select a GTM account, container, and workspace
4. Browse and edit your Custom HTML tags, Custom JavaScript variables, and Custom Templates
5. Modified files are marked with a dot indicator
6. Use **Push Changes** to save your changes back to GTM

### Working with Custom Templates

Custom Templates are displayed as folders containing their sections:
- `SANDBOXED_JS_FOR_WEB_TEMPLATE.js` / `SANDBOXED_JS_FOR_SERVER.js` - The template JavaScript code
- `TEMPLATE_PARAMETERS.json` - Template input fields configuration
- `WEB_PERMISSIONS.json` - Required permissions (auto-detected from code)
- `INFO.json` - Template metadata
- `TESTS.json` - Template tests

When you save a JavaScript file, GTMSense automatically detects which APIs you're using (like `logToConsole`, `copyFromWindow`, etc.) and updates the permissions section accordingly.

## Commands

| Command | Description |
|---------|-------------|
| `GTM-SENSE: Load Container` | Load a GTM container and workspace |
| `GTM-SENSE: Unload Container` | Unload a container from the sidebar |
| `GTM-SENSE: Create Custom HTML Tag` | Create a new Custom HTML tag |
| `GTM-SENSE: Create Custom JavaScript Variable` | Create a new Custom JavaScript variable |
| `GTM-SENSE: Create Custom Template` | Create a new Custom Template (Tag or Variable) |
| `GTM-SENSE: Create Workspace` | Create a new workspace in the container |
| `GTM-SENSE: Reload Workspace` | Reload workspace data from GTM |
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
