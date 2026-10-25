# RPG Asset Workbench (R-aW)

<img src="../../resources/icon.png" alt="R-aW" width="96" height="96" />

[繁體中文](../../README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · English

Manage image replacements for RPG Maker MV/MZ on Windows: keep a fixed original backup, preview replacement versions, match batches, and apply or restore images after confirmation.

The current source version is **0.5.5**. Version 1.0 is being prepared, not announced as released. The target is Windows x64; the minimum Windows version and ARM64 have not been validated.

## Download and run

When available, download the Windows x64 release ZIP from this repository's **Releases** page. GitHub's “Source code” ZIP is not a runnable application. If no release asset is listed, a download package is not yet available.

Extract the **entire ZIP** into a writable folder and open `RPG Asset Workbench.exe`. Keep all accompanying files. Do not move only the EXE or launch it inside the ZIP. The packaged application does not require a separate Node.js installation.

## Quick start

1. Make an independent backup of the game. Create your first project from a trusted, unmodified game copy so the tool can preserve a fixed original baseline.
2. Create a project on the home screen, select the game location, and let scanning finish. Cancelling preserves progress for resuming; incomplete scans cannot be applied.
3. Search the workbench, browse original folders, or create custom groups. Click original or replacement previews to enlarge them.
4. Drop one static PNG onto an asset's replacement column and confirm the import. Drop multiple files for batch matching. Resolve ambiguous matches manually and review the targets before confirming.
5. Selecting a version only stages a change. Use “Apply to game” and confirm before files are written. Check the result inside the game.
6. Selecting the original also requires applying the change. Use restoration when needed; version history is retained.

The home-screen language icon switches between Traditional Chinese, Simplified Chinese, English, and Japanese. Project settings provide names, covers, and location relinking. Custom groups support renaming and membership changes.

## Data, backups, and deletion

- Tool data is stored separately in the Windows user's application data directory, not entirely beside the EXE. An extract-and-run ZIP does not mean project data travels with the application folder.
- Before upgrading, close the application and back up both the game and the complete tool data directory. Extract the new version into a separate folder. If old projects are missing, stop and report the issue instead of recreating projects or deleting old data.
- **Permanently deleting a project removes its tool-managed original backups, replacement versions, and related data. You lose the tool's backup/restore capability. Game files remain in their current state; deletion does not restore them.** Restore and verify the originals first if that is what you want.
- Removing a group or its members only removes classification links. Cancelling a pending change differs from deleting a version. Originals and deployed versions cannot be deleted individually.
- Deleting the extracted application folder does not clear tool data. Do not delete the tool data directory while you still need restoration.

## Support and limits

- RPG Maker MV/MZ with unencrypted or standard encrypted images. Custom encryption and modified engines are not guaranteed.
- Static PNG only; JPEG, APNG, and disguised file extensions are rejected. File size limit: 32 MiB.
- Normal limit: 16,777,216 pixels. Replacement and batch imports can process larger images after confirmation, up to 33,554,432 pixels. Original scans and project covers retain the normal limit.
- Incremental scanning only adds confirmed new paths; it does not overwrite the original baseline. Relink a moved game. Saved data remains viewable offline, but game writes are disabled.
- External changes block apply/restore operations; there is no force-overwrite option. Follow recovery prompts after a failure and retain backups and error messages.
- Clean-Windows, final-package, and upgrade compatibility checks still have outstanding items. This is not a fully validated 1.0 release.

## Reporting problems and license

Use this repository's Issues, if enabled. Include the application, Windows, and engine versions; reproduction steps; expected/actual results; and error screenshots. Redact personal paths. Do not upload complete private games, encryption keys, or assets you are not authorized to share.

[MIT License](../../LICENSE), Copyright © 2026 Zeke Gan. Third-party components and game assets retain their own licenses. Notices in the final distribution still require review before release.

[Version notes](../UPDATE_0.5.5.md) · [Developer and AI documentation](../development/INDEX.md)
