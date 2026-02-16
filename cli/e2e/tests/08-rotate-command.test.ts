import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { generateEd25519Key, generateRsaKey, runCli, createMockEditor } from "../helpers/cli"

const TIMEOUT = 30_000

describe("Rotate Command", () => {
	let aliceHome: string
	let bobHome: string
	let workspace: string
	let encPath: string
	let contentBeforeRotation: string

	beforeAll(() => {
		aliceHome = mkdtempSync(path.join(os.tmpdir(), "e2e-08-alice-"))
		bobHome = mkdtempSync(path.join(os.tmpdir(), "e2e-08-bob-"))
		workspace = mkdtempSync(path.join(os.tmpdir(), "e2e-08-workspace-"))
		generateEd25519Key(aliceHome)
		generateRsaKey(bobHome)

		runCli(aliceHome, workspace, ["init", "--name", "alice"])
		runCli(aliceHome, workspace, ["env", "create", "staging", "alice"])

		const editor = createMockEditor("ROTATE_SECRET=before-rotation")
		runCli(aliceHome, workspace, ["env", "edit", "staging"], { EDITOR: editor })

		runCli(aliceHome, workspace, ["key", "add", "bob", "--from-ssh", path.join(bobHome, ".ssh", "id_rsa")])
		runCli(aliceHome, workspace, ["auth", "grant", "staging", "bob"])

		encPath = path.join(workspace, ".env.staging.enc")
		contentBeforeRotation = readFileSync(encPath, "utf-8")
	})

	afterAll(() => {
		rmSync(aliceHome, { recursive: true, force: true })
		rmSync(bobHome, { recursive: true, force: true })
		rmSync(workspace, { recursive: true, force: true })
	})

	test("rotate changes the encrypted file", () => {
		runCli(aliceHome, workspace, ["env", "rotate", "staging"])
		const contentAfterRotation = readFileSync(encPath, "utf-8")
		expect(contentAfterRotation).not.toBe(contentBeforeRotation)
	}, TIMEOUT)

	test("rotate preserves the number of authorized keys", () => {
		const env = JSON.parse(readFileSync(encPath, "utf-8"))
		expect(env.keys).toHaveLength(2)
	}, TIMEOUT)

	test("Alice can still decrypt after rotation", () => {
		const result = runCli(aliceHome, workspace, ["run", "-e", "staging", "--", "sh", "-c", "echo $ROTATE_SECRET"])
		expect(result.stdout).toContain("before-rotation")
	}, TIMEOUT)

	test("Bob can still decrypt after rotation", () => {
		const result = runCli(bobHome, workspace, ["run", "-e", "staging", "--", "sh", "-c", "echo $ROTATE_SECRET"])
		expect(result.stdout).toContain("before-rotation")
	}, TIMEOUT)

	test("rotate prints success message", () => {
		const result = runCli(aliceHome, workspace, ["env", "rotate", "staging"])
		expect(result.stdout).toContain("Data key for staging has been rotated.")
	}, TIMEOUT)
})
