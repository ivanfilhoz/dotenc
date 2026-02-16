import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { generateEd25519Key, generatePassphraseEd25519Key, runCli } from "../helpers/cli"

const TIMEOUT = 30_000

describe("Passphrase-protected key errors", () => {
	let passphraseHome: string
	let aliceHome: string
	let workspace: string

	beforeAll(() => {
		passphraseHome = mkdtempSync(path.join(os.tmpdir(), "e2e-12-passphrase-"))
		aliceHome = mkdtempSync(path.join(os.tmpdir(), "e2e-12-alice-"))
		workspace = mkdtempSync(path.join(os.tmpdir(), "e2e-12-workspace-"))

		generatePassphraseEd25519Key(passphraseHome)
		generateEd25519Key(aliceHome)

		// Set up a project with alice so we can test whoami and key add
		runCli(aliceHome, workspace, ["init", "--name", "alice"])
	})

	afterAll(() => {
		rmSync(passphraseHome, { recursive: true, force: true })
		rmSync(aliceHome, { recursive: true, force: true })
		rmSync(workspace, { recursive: true, force: true })
	})

	test("init shows passphrase error when only passphrase keys exist", () => {
		const emptyWorkspace = mkdtempSync(path.join(os.tmpdir(), "e2e-12-init-"))
		try {
			const result = runCli(passphraseHome, emptyWorkspace, ["init", "--name", "test"])
			expect(result.stderr).toContain("passphrase-protected")
			expect(result.stderr).toContain("not currently supported")
			expect(result.stderr).toContain("id_ed25519")
		} finally {
			rmSync(emptyWorkspace, { recursive: true, force: true })
		}
	}, TIMEOUT)

	test("key add --from-ssh shows passphrase error for protected key", () => {
		const keyPath = path.join(passphraseHome, ".ssh", "id_ed25519")
		const result = runCli(aliceHome, workspace, ["key", "add", "test", "--from-ssh", keyPath])
		expect(result.stderr).toContain("passphrase-protected")
		expect(result.stderr).toContain("not currently supported")
	}, TIMEOUT)

	test("key add --from-file shows passphrase error for protected key", () => {
		const keyPath = path.join(passphraseHome, ".ssh", "id_ed25519")
		const result = runCli(aliceHome, workspace, ["key", "add", "test", "--from-file", keyPath])
		expect(result.stderr).toContain("passphrase-protected")
		expect(result.stderr).toContain("not currently supported")
	}, TIMEOUT)

	test("DOTENC_PRIVATE_KEY shows passphrase error for protected key", () => {
		const privateKey = readFileSync(path.join(passphraseHome, ".ssh", "id_ed25519"), "utf-8")
		const result = runCli(aliceHome, workspace, ["run", "-e", "alice", "--", "echo", "test"], {
			DOTENC_PRIVATE_KEY: privateKey,
		})
		expect(result.stderr).toContain("passphrase-protected")
		expect(result.stderr).toContain("not currently supported")
	}, TIMEOUT)

	test("whoami shows passphrase error when only passphrase keys exist", () => {
		const result = runCli(passphraseHome, workspace, ["whoami"])
		expect(result.stderr).toContain("passphrase-protected")
		expect(result.stderr).toContain("not currently supported")
		expect(result.stderr).toContain("id_ed25519")
	}, TIMEOUT)

	test("run shows passphrase error when only passphrase keys exist", () => {
		const result = runCli(passphraseHome, workspace, ["run", "-e", "alice", "--", "echo", "test"])
		expect(result.stderr).toContain("passphrase-protected")
		expect(result.stderr).toContain("not currently supported")
	}, TIMEOUT)
})
