import { describe, expect, mock, test } from "bun:test"
import type { CreateCommandDeps } from "../commands/env/create"
import {
	_normalizePublicKeyNamesForCreate,
	createCommand,
} from "../commands/env/create"

const ROOT = "/workspace"

describe("createCommand key selection normalization", () => {
	test("normalizes a single selected key string into an array", () => {
		expect(_normalizePublicKeyNamesForCreate("ivan")).toEqual(["ivan"])
	})

	test("keeps an array selection unchanged", () => {
		expect(_normalizePublicKeyNamesForCreate(["ivan", "alice"])).toEqual([
			"ivan",
			"alice",
		])
	})

	test("returns empty array for missing or blank selection", () => {
		expect(_normalizePublicKeyNamesForCreate(undefined)).toEqual([])
		expect(_normalizePublicKeyNamesForCreate("")).toEqual([])
		expect(_normalizePublicKeyNamesForCreate("   ")).toEqual([])
	})
})

const makePublicKey = (name: string) => ({
	name,
	algorithm: "ed25519" as const,
	fingerprint: `SHA256:${name}`,
	publicKey: {} as never,
	rawPublicKey: Buffer.alloc(32),
})

const createBaseDeps = (
	overrides: Partial<CreateCommandDeps> = {},
): Partial<CreateCommandDeps> => ({
	resolveProjectRoot: () => ROOT,
	existsSync: () => true,
	environmentExists: () => false,
	getPublicKeys: mock(async () => [
		makePublicKey("alice"),
	]) as unknown as CreateCommandDeps["getPublicKeys"],
	writeFile: mock(async () => {}) as unknown as CreateCommandDeps["writeFile"],
	cwd: () => ROOT,
	logError: mock((_msg: string) => {}),
	log: mock((_msg: string) => {}),
	exit: mock((code: number): never => {
		throw new Error(`exit(${code})`)
	}),
	...overrides,
})

describe("createCommand location resolution", () => {
	test("creates file in cwd", async () => {
		const writeFile = mock(
			async () => {},
		) as unknown as CreateCommandDeps["writeFile"]

		await createCommand("staging", "alice", undefined, {
			...createBaseDeps(),
			cwd: () => ROOT,
			writeFile,
		})

		const writtenPath = String(
			(writeFile as ReturnType<typeof mock>).mock.calls[0]?.[0],
		)
		expect(writtenPath.startsWith(ROOT)).toBe(true)
	})
})
