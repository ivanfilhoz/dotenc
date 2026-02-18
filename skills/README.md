# dotenc Claude Code Skill

A [Claude Code](https://docs.anthropic.com/en/docs/claude-code) skill that lets you manage dotenc encrypted environments directly from Claude Code using the `/dotenc` slash command.

## Installation

1. Copy the `skills/dotenc/` directory into your project's `.claude/skills/`:

```bash
mkdir -p .claude/skills
cp -r skills/dotenc .claude/skills/
```

2. Open Claude Code and run `/dotenc` to verify the skill is loaded.

## What it provides

- **Context awareness** — Claude automatically sees your current identity, available environments, and project keys.
- **`/dotenc` slash command** — Ask Claude to create environments, manage access, rotate keys, and more.
- **Safety guardrails** — Claude will never print decrypted secrets in chat and will confirm before destructive operations.
