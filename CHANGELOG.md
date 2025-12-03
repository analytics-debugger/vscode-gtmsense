# Changelog

All notable changes to GTMSense will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


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

[0.0.2]: https://github.com/analytics-debugger/vscode-gtmsense/compare/archive/v0.0.1...v0.0.2
[0.0.1]: https://github.com/analytics-debugger/vscode-gtmsense/releases/tag/archive/v0.0.1
