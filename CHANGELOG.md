# Changelog

All notable changes to GTMSense will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


## [0.0.3] - 2025-12-03

### Added

- **Caching for API calls**: Accounts, containers, and workspaces are now cached for faster navigation
- **Refresh option**: Added refresh buttons to reload accounts, containers, and workspaces from the API
- **Navigation**: Added "back" navigation (`..`) to go from containers to accounts, and from workspaces to containers
- **Output channel**: Added GTMSense output channel for logging and debugging
- **Version info**: Output channel shows extension and VSCode version on activation
- **Improved error reporting**: Push failures now show detailed errors in the output channeltt

### Changed

- Container/workspace selection now shows current context in placeholder (e.g., "Select Container (Account Name)")
- GitHub Actions workflow now supports creating releases from manual dispatch

## [0.0.2] - 2025-12-03

### Added

- Rename tags and variables (right-click > Rename)
  - Renames are queued as pending changes and pushed with other modifications
  - Discard changes restores the original name

### Fixed

- Fixed URI encoding issues with container names containing spaces or special characters
- Fixed create tag/variable commands not working from workspace context menu
- Create tag/variable menu items now appear on workspace instead of container

## [0.0.1] - 2025-12-02

### Added

- Initial release of GTMSense
- Load GTM containers and workspaces directly in VS Code
- Edit Custom HTML tags and Custom JavaScript variables
- GTM-specific JavaScript syntax highlighting
- IntelliSense for GTM built-in variables (`{{Variable Name}}` syntax)
- Push changes back to GTM
- Discard changes at file or container level
- Create new Custom HTML tags and Custom JavaScript variables
- Visual indicators for modified files
- Badge count for pending changes
- Google OAuth authentication
- Multiple container/workspace support

[0.0.3]: https://github.com/analytics-debugger/vscode-gtmsense/compare/v0.0.2...v0.0.3
[0.0.2]: https://github.com/analytics-debugger/vscode-gtmsense/compare/v0.0.1...v0.0.2
[0.0.1]: https://github.com/analytics-debugger/vscode-gtmsense/releases/tag/v0.0.1
