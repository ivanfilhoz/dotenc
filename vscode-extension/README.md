# dotenc VS Code Extension

This extension provides seamless editing for encrypted dotenc files:

- Opens `.env.<environment>.enc` files as decrypted plaintext for authorized users.
- Saves plaintext changes back as encrypted content.
- Shows a clear access message with team onboarding instructions when you do not have access.

## Requirements

- `dotenc` CLI available in your PATH, or set `dotenc.executablePath` in VS Code settings.
- `dotenc` CLI version `0.4.6` or newer.
- A dotenc project initialized in your workspace.

## Settings

- `dotenc.executablePath`: path to the dotenc executable (default: `dotenc`).
