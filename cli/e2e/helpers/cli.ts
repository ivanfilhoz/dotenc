import { mkdirSync, writeFileSync, chmodSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

const CLI_PATH = "/app/cli/src/cli.ts"

type Ed25519KeyOptions = {
	fileName?: string
	passphrase?: string
}

type RsaKeyOptions = {
	fileName?: string
	bits?: number
	passphrase?: string
}

export function generateEd25519Key(
	homeDir: string,
	options: Ed25519KeyOptions = {},
): void {
	const sshDir = path.join(homeDir, ".ssh")
	mkdirSync(sshDir, { recursive: true })
	const fileName = options.fileName ?? "id_ed25519"
	const passphrase = options.passphrase ?? ""
	const result = Bun.spawnSync(
		[
			"ssh-keygen",
			"-t",
			"ed25519",
			"-f",
			path.join(sshDir, fileName),
			"-N",
			passphrase,
			"-q",
		],
	)
	if (result.exitCode !== 0) {
		throw new Error(`ssh-keygen ed25519 failed: ${result.stderr.toString()}`)
	}
}

export function generateRsaKey(
	homeDir: string,
	options: RsaKeyOptions = {},
): void {
	const sshDir = path.join(homeDir, ".ssh")
	mkdirSync(sshDir, { recursive: true })
	const fileName = options.fileName ?? "id_rsa"
	const bits = options.bits ?? 2048
	const passphrase = options.passphrase ?? ""
	const result = Bun.spawnSync(
		[
			"ssh-keygen",
			"-t",
			"rsa",
			"-b",
			String(bits),
			"-f",
			path.join(sshDir, fileName),
			"-N",
			passphrase,
			"-q",
		],
	)
	if (result.exitCode !== 0) {
		throw new Error(`ssh-keygen rsa failed: ${result.stderr.toString()}`)
	}
}

export function generatePassphraseEd25519Key(homeDir: string): void {
	generateEd25519Key(homeDir, { passphrase: "secret" })
}

export function runCli(
	homeDir: string,
	workspace: string,
	args: string[],
	extraEnv?: Record<string, string>,
): { stdout: string; stderr: string; exitCode: number } {
	const result = Bun.spawnSync(["bun", CLI_PATH, ...args], {
		cwd: workspace,
		env: {
			...process.env,
			HOME: homeDir,
			DOTENC_SKIP_UPDATE_CHECK: "1",
			...extraEnv,
		},
	})
	return {
		stdout: result.stdout.toString(),
		stderr: result.stderr.toString(),
		exitCode: result.exitCode,
	}
}

export function runCliWithStdin(
	homeDir: string,
	workspace: string,
	args: string[],
	stdin: string,
	extraEnv?: Record<string, string>,
): { stdout: string; stderr: string; exitCode: number } {
	const result = Bun.spawnSync(["bun", CLI_PATH, ...args], {
		cwd: workspace,
		env: {
			...process.env,
			HOME: homeDir,
			DOTENC_SKIP_UPDATE_CHECK: "1",
			...extraEnv,
		},
		stdin: Buffer.from(stdin),
	})
	return {
		stdout: result.stdout.toString(),
		stderr: result.stderr.toString(),
		exitCode: result.exitCode,
	}
}

export function createMockEditor(content: string): string {
	const contentFile = path.join(tmpdir(), `mock-editor-content-${Date.now()}-${Math.random().toString(36).slice(2)}`)
	writeFileSync(contentFile, content + "\n")

	const scriptFile = path.join(tmpdir(), `mock-editor-${Date.now()}-${Math.random().toString(36).slice(2)}.sh`)
	writeFileSync(
		scriptFile,
		`#!/bin/bash
FILE="$1"
{
    sed -n '1,/^# ---$/p' "$FILE"
    cat "${contentFile}"
} > "\${FILE}.tmp"
mv "\${FILE}.tmp" "$FILE"
`,
	)
	chmodSync(scriptFile, 0o755)
	return scriptFile
}
