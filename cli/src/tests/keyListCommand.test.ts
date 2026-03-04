import { describe, expect, mock, test } from "bun:test"
import path from "node:path"
import type { KeyListCommandDeps } from "../commands/key/list"
import { keyListCommand } from "../commands/key/list"

const ROOT = "/workspace"
const SUBDIR = path.join(ROOT, "packages", "web")

const makeKey = (name: string) => ({
	name,
	algorithm: "ed25519" as const,
	fingerprint: `SHA256:${name}`,
	publicKey: {} as never,
	rawPublicKey: Buffer.alloc(32),
})

describe("keyListCommand", () => {
	test("prints 'No public keys found' when none exist", async () => {
		const log = mock((_msg: string) => {})

		await keyListCommand({
			getPublicKeys: mock(
				async () => [],
			) as unknown as KeyListCommandDeps["getPublicKeys"],
			resolveProjectRoot: () => ROOT,
			existsSync: () => true,
			cwd: () => ROOT,
			log,
		})

		const logged = log.mock.calls.map((c) => String(c[0]))
		expect(logged.some((m) => m.includes("No public keys found"))).toBe(true)
	})

	test("lists keys with name and algorithm", async () => {
		const log = mock((_msg: string) => {})

		await keyListCommand({
			getPublicKeys: mock(async () => [
				makeKey("alice"),
				makeKey("bob"),
			]) as unknown as KeyListCommandDeps["getPublicKeys"],
			resolveProjectRoot: () => ROOT,
			existsSync: () => true,
			cwd: () => ROOT,
			log,
		})

		const logged = log.mock.calls.map((c) => String(c[0]))
		expect(logged.some((m) => m.includes("alice"))).toBe(true)
		expect(logged.some((m) => m.includes("bob"))).toBe(true)
	})

	test("reads from projectRoot .dotenc when cwd is a subdir", async () => {
		const getPublicKeys = mock(async (_dotencDir: string) => [makeKey("alice")])

		await keyListCommand({
			getPublicKeys:
				getPublicKeys as unknown as KeyListCommandDeps["getPublicKeys"],
			resolveProjectRoot: () => ROOT,
			existsSync: () => true,
			cwd: () => SUBDIR,
			log: () => {},
		})

		// Should call getPublicKeys with ROOT/.dotenc, not SUBDIR/.dotenc
		const calledWith = String(getPublicKeys.mock.calls[0]?.[0])
		expect(calledWith).toBe(path.join(ROOT, ".dotenc"))
	})

	test("falls back to cwd when resolveProjectRoot throws", async () => {
		const getPublicKeys = mock(async (_dotencDir: string) => [])

		await keyListCommand({
			getPublicKeys:
				getPublicKeys as unknown as KeyListCommandDeps["getPublicKeys"],
			resolveProjectRoot: () => {
				throw new Error("not a project")
			},
			existsSync: () => false,
			cwd: () => ROOT,
			log: () => {},
		})

		const calledWith = String(getPublicKeys.mock.calls[0]?.[0])
		expect(calledWith).toBe(path.join(ROOT, ".dotenc"))
	})
})
