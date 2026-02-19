import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test"
import crypto from "node:crypto"
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { editCommand } from "../commands/env/edit"
import { createDataKey, encryptData } from "../helpers/crypto"
import { decryptEnvironment } from "../helpers/decryptEnvironment"
import { encryptDataKey } from "../helpers/encryptDataKey"
import { getEnvironmentByName } from "../helpers/getEnvironmentByName"
import { getKeyFingerprint } from "../helpers/getKeyFingerprint"

const createMockEditorScript = () => {
	const scriptPath = path.join(
		os.tmpdir(),
		`dotenc-edit-test-${Date.now()}-${Math.random().toString(36).slice(2)}.sh`,
	)

	writeFileSync(
		scriptPath,
		`#!/bin/sh
if [ "$1" = "--wait" ]; then
  FILE="$2"
else
  FILE="$1"
fi

{
  sed -n '1,/^# ---$/p' "$FILE"
  echo "UPDATED=1"
} > "$FILE.tmp"
mv "$FILE.tmp" "$FILE"
`,
		"utf-8",
	)
	Bun.spawnSync(["chmod", "+x", scriptPath])
	return scriptPath
}

describe("editCommand", () => {
	let workspace: string
	let homeDir: string
	let cwdSpy: ReturnType<typeof spyOn>
	let homedirSpy: ReturnType<typeof spyOn>
	let originalPrivateKeyEnv: string | undefined
	let originalHomeEnv: string | undefined
	let originalEditorEnv: string | undefined
	let editorScriptPath: string

	beforeEach(async () => {
		workspace = mkdtempSync(path.join(os.tmpdir(), "dotenc-edit-workspace-"))
		homeDir = mkdtempSync(path.join(os.tmpdir(), "dotenc-edit-home-"))
		cwdSpy = spyOn(process, "cwd").mockReturnValue(workspace)
		homedirSpy = spyOn(os, "homedir").mockReturnValue(homeDir)
		originalPrivateKeyEnv = process.env.DOTENC_PRIVATE_KEY
		originalHomeEnv = process.env.HOME
		originalEditorEnv = process.env.EDITOR

		const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519")
		const privateKeyPem = privateKey
			.export({ type: "pkcs8", format: "pem" })
			.toString("utf-8")
		await fs.mkdir(path.join(homeDir, ".ssh"), { recursive: true })
		await fs.writeFile(
			path.join(homeDir, ".ssh", "id_ed25519"),
			privateKeyPem,
			{
				encoding: "utf-8",
				mode: 0o600,
			},
		)

		const fingerprint = getKeyFingerprint(publicKey)
		const rawPublicKey = Buffer.from(
			publicKey.export({ type: "spki", format: "der" }).subarray(-32),
		)
		const dataKey = createDataKey()
		const encryptedDataKey = encryptDataKey(
			{
				algorithm: "ed25519",
				publicKey,
				rawPublicKey,
			},
			dataKey,
		)
		const encryptedContent = await encryptData(dataKey, "ORIGINAL=1\n")

		const envPayload = {
			keys: [
				{
					name: "alice",
					fingerprint,
					encryptedDataKey: encryptedDataKey.toString("base64"),
					algorithm: "ed25519" as const,
				},
			],
			encryptedContent: encryptedContent.toString("base64"),
		}

		await fs.mkdir(path.join(workspace, ".dotenc"), { recursive: true })
		await fs.writeFile(
			path.join(workspace, ".dotenc", "alice.pub"),
			publicKey.export({ type: "spki", format: "pem" }).toString("utf-8"),
			"utf-8",
		)

		await fs.writeFile(
			path.join(workspace, ".env.test.enc"),
			JSON.stringify(envPayload, null, 2),
			"utf-8",
		)

		process.env.HOME = homeDir
		delete process.env.DOTENC_PRIVATE_KEY
		editorScriptPath = createMockEditorScript()
		process.env.EDITOR = `${editorScriptPath} --wait`
	})

	afterEach(() => {
		cwdSpy.mockRestore()
		homedirSpy.mockRestore()
		rmSync(workspace, { recursive: true, force: true })
		if (existsSync(editorScriptPath)) {
			rmSync(editorScriptPath, { force: true })
		}
		rmSync(homeDir, { recursive: true, force: true })

		if (originalHomeEnv === undefined) {
			delete process.env.HOME
		} else {
			process.env.HOME = originalHomeEnv
		}

		if (originalPrivateKeyEnv === undefined) {
			delete process.env.DOTENC_PRIVATE_KEY
		} else {
			process.env.DOTENC_PRIVATE_KEY = originalPrivateKeyEnv
		}

		if (originalEditorEnv === undefined) {
			delete process.env.EDITOR
		} else {
			process.env.EDITOR = originalEditorEnv
		}
	})

	test("supports editor commands with arguments from config/env", async () => {
		await editCommand("test")

		const updated = await getEnvironmentByName("test")
		expect(updated.keys).toHaveLength(1)
		const decrypted = await decryptEnvironment("test")
		expect(decrypted).toBe("UPDATED=1")

		const tmpRaw = await fs.readFile(
			path.join(workspace, ".env.test.enc"),
			"utf-8",
		)
		expect(tmpRaw).toContain('"encryptedContent"')
	})
})
