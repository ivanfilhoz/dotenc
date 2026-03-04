import { describe, expect, mock, test } from "bun:test"
import path from "node:path"
import type { WhoamiCommandDeps } from "../commands/whoami"
import { whoamiCommand } from "../commands/whoami"
import type { EnvFile } from "../helpers/findEnvironmentsRecursive"

const ROOT = "/workspace"
const SUBDIR = path.join(ROOT, "packages", "web")

const makePublicKey = (name: string, fingerprint: string) => ({
	name,
	algorithm: "ed25519" as const,
	fingerprint,
	publicKey: {} as never,
	rawPublicKey: Buffer.alloc(32),
})

const makePrivateKey = (name: string, fingerprint: string) => ({
	name,
	fingerprint,
	privateKey: {} as never,
	algorithm: "ed25519" as const,
})

const makeEnvFile = (name: string, dir = ROOT): EnvFile => ({
	name,
	dir,
	filePath: path.join(dir, `.env.${name}.enc`),
})

const makeEnvJson = (fingerprint: string) => ({
	version: 2 as const,
	keys: [
		{
			fingerprint,
			name: "alice",
			encryptedDataKey: "",
			algorithm: "ed25519" as const,
		},
	],
	encryptedContent: "",
})

describe("whoamiCommand", () => {
	test("exits when no matching key found", async () => {
		const logError = mock((_msg: string) => {})
		const exit = mock((code: number): never => {
			throw new Error(`exit(${code})`)
		})

		await expect(
			whoamiCommand({
				getPrivateKeys: mock(async () => ({
					keys: [],
					passphraseProtectedKeys: [],
				})) as unknown as WhoamiCommandDeps["getPrivateKeys"],
				getPublicKeys: mock(
					async () => [],
				) as unknown as WhoamiCommandDeps["getPublicKeys"],
				findEnvironmentsRecursive: mock(
					async () => [],
				) as unknown as WhoamiCommandDeps["findEnvironmentsRecursive"],
				getEnvironmentByPath: mock(async () => ({
					keys: [],
					encryptedContent: "",
				})) as unknown as WhoamiCommandDeps["getEnvironmentByPath"],
				resolveProjectRoot: () => ROOT,
				existsSync: () => true,
				cwd: () => ROOT,
				log: mock((_msg: string) => {}),
				logError,
				exit,
			}),
		).rejects.toThrow("exit(1)")

		expect(exit).toHaveBeenCalledWith(1)
	})

	test("prints identity and authorized environments for matching key", async () => {
		const log = mock((_msg: string) => {})

		await whoamiCommand({
			getPrivateKeys: mock(async () => ({
				keys: [makePrivateKey("id_ed25519", "SHA256:alice")],
				passphraseProtectedKeys: [],
			})) as unknown as WhoamiCommandDeps["getPrivateKeys"],
			getPublicKeys: mock(async () => [
				makePublicKey("alice", "SHA256:alice"),
			]) as unknown as WhoamiCommandDeps["getPublicKeys"],
			findEnvironmentsRecursive: mock(async () => [
				makeEnvFile("staging"),
			]) as unknown as WhoamiCommandDeps["findEnvironmentsRecursive"],
			getEnvironmentByPath: mock(async () =>
				makeEnvJson("SHA256:alice"),
			) as unknown as WhoamiCommandDeps["getEnvironmentByPath"],
			resolveProjectRoot: () => ROOT,
			existsSync: () => true,
			cwd: () => ROOT,
			log,
			logError: mock((_msg: string) => {}),
			exit: mock((code: number): never => {
				throw new Error(`exit(${code})`)
			}),
		})

		const logged = log.mock.calls.map((c) => String(c[0]))
		expect(logged.some((m) => m.includes("alice"))).toBe(true)
		expect(logged.some((m) => m.includes("staging"))).toBe(true)
	})

	test("reads .dotenc from projectRoot when cwd is a subdir", async () => {
		const getPublicKeys = mock(async (_dotencDir: string) => [])
		const exit = mock((code: number): never => {
			throw new Error(`exit(${code})`)
		})

		await expect(
			whoamiCommand({
				getPrivateKeys: mock(async () => ({
					keys: [makePrivateKey("id_ed25519", "SHA256:alice")],
					passphraseProtectedKeys: [],
				})) as unknown as WhoamiCommandDeps["getPrivateKeys"],
				getPublicKeys:
					getPublicKeys as unknown as WhoamiCommandDeps["getPublicKeys"],
				findEnvironmentsRecursive: mock(
					async () => [],
				) as unknown as WhoamiCommandDeps["findEnvironmentsRecursive"],
				getEnvironmentByPath: mock(async () => ({
					keys: [],
					encryptedContent: "",
				})) as unknown as WhoamiCommandDeps["getEnvironmentByPath"],
				resolveProjectRoot: () => ROOT,
				existsSync: () => true,
				cwd: () => SUBDIR,
				log: mock((_msg: string) => {}),
				logError: mock((_msg: string) => {}),
				exit,
			}),
		).rejects.toThrow("exit(1)") // No matching key found → exit(1)

		// getPublicKeys should be called with ROOT/.dotenc, not SUBDIR/.dotenc
		const calledWith = String(getPublicKeys.mock.calls[0]?.[0])
		expect(calledWith).toBe(path.join(ROOT, ".dotenc"))
	})

	test("shows environments from all directory levels in a monorepo", async () => {
		const log = mock((_msg: string) => {})

		await whoamiCommand({
			getPrivateKeys: mock(async () => ({
				keys: [makePrivateKey("id_ed25519", "SHA256:alice")],
				passphraseProtectedKeys: [],
			})) as unknown as WhoamiCommandDeps["getPrivateKeys"],
			getPublicKeys: mock(async () => [
				makePublicKey("alice", "SHA256:alice"),
			]) as unknown as WhoamiCommandDeps["getPublicKeys"],
			findEnvironmentsRecursive: mock(async () => [
				makeEnvFile("staging", ROOT),
				makeEnvFile("staging", SUBDIR),
			]) as unknown as WhoamiCommandDeps["findEnvironmentsRecursive"],
			getEnvironmentByPath: mock(async () =>
				makeEnvJson("SHA256:alice"),
			) as unknown as WhoamiCommandDeps["getEnvironmentByPath"],
			resolveProjectRoot: () => ROOT,
			existsSync: () => true,
			cwd: () => ROOT,
			log,
			logError: mock((_msg: string) => {}),
			exit: mock((code: number): never => {
				throw new Error(`exit(${code})`)
			}),
		})

		const logged = log.mock.calls.map((c) => String(c[0]))
		// Root-level staging has no qualifier
		expect(logged.some((m) => m === "  - staging")).toBe(true)
		// Subdir staging shows relative path
		expect(
			logged.some((m) => m.includes("staging") && m.includes("packages/web")),
		).toBe(true)
	})
})
