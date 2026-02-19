import { describe, expect, mock, test } from "bun:test"
import crypto from "node:crypto"
import path from "node:path"
import { _runKeyAddCommand } from "../commands/key/add"

type RunKeyAddDeps = NonNullable<Parameters<typeof _runKeyAddCommand>[2]>

type DepsFactoryResult = {
	deps: RunKeyAddDeps
	errors: string[]
	infos: string[]
	createdDirs: Set<string>
	writes: Map<string, string>
}

const makeDeps = (
	overrides: Partial<RunKeyAddDeps> = {},
): DepsFactoryResult => {
	const cwd = "/workspace"
	const home = "/home/tester"
	const errors: string[] = []
	const infos: string[] = []
	const createdDirs = new Set<string>()
	const writes = new Map<string, string>()
	const readableFiles = new Map<string, string>()
	const existingPaths = new Set<string>()

	const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519")
	const publicPem = publicKey
		.export({ type: "spki", format: "pem" })
		.toString("utf-8")
	const privatePem = privateKey
		.export({ type: "pkcs8", format: "pem" })
		.toString("utf-8")

	const sshPath = path.join(home, ".ssh", "id_ed25519")
	existingPaths.add(sshPath)
	readableFiles.set(sshPath, privatePem)

	const deps: RunKeyAddDeps = {
		createPrivateKey: crypto.createPrivateKey,
		createPublicKey: crypto.createPublicKey,
		existsSync: (filePath) => existingPaths.has(String(filePath)),
		readFile: (async (filePath: unknown) => {
			const value = readableFiles.get(String(filePath))
			if (value === undefined) {
				throw new Error(`ENOENT: ${String(filePath)}`)
			}
			return value
		}) as never,
		mkdir: async (dirPath) => {
			const normalized = String(dirPath)
			createdDirs.add(normalized)
			existingPaths.add(normalized)
		},
		writeFile: async (filePath, data) => {
			const normalized = String(filePath)
			writes.set(normalized, String(data))
			existingPaths.add(normalized)
		},
		homedir: () => home,
		cwd: () => cwd,
		prompt: mock(async () => ({ mode: "paste" })) as never,
		isPassphraseProtected: () => false,
		parseOpenSSHPrivateKey: () => null,
		validatePublicKey: () => ({ valid: true }),
		validateKeyName: () => ({ valid: true }),
		choosePrivateKeyPrompt: mock(async () => ({
			name: "id_ed25519",
			privateKey,
			fingerprint: "fingerprint",
			algorithm: "ed25519",
			rawSeed: Buffer.alloc(32),
			rawPublicKey: Buffer.alloc(32),
		})) as never,
		inputKeyPrompt: mock(async () => publicPem) as never,
		inputNamePrompt: mock(async () => "alice") as never,
		logError: (message) => {
			errors.push(message)
		},
		logInfo: (message) => {
			infos.push(message)
		},
		exit: ((code: number): never => {
			throw new Error(`exit(${code})`)
		}) as never,
		...overrides,
	}

	return {
		deps,
		errors,
		infos,
		createdDirs,
		writes,
	}
}

describe("keyAddCommand", () => {
	test("rejects when --from-ssh path does not exist", async () => {
		const { deps } = makeDeps({
			existsSync: () => false,
		})

		await expect(
			_runKeyAddCommand("alice", { fromSsh: "~/.ssh/id_missing" }, deps),
		).rejects.toThrow("exit(1)")
	})

	test("rejects passphrase-protected SSH key content", async () => {
		const { deps } = makeDeps({
			isPassphraseProtected: () => true,
		})

		await expect(
			_runKeyAddCommand("alice", { fromSsh: "~/.ssh/id_ed25519" }, deps),
		).rejects.toThrow("exit(1)")
	})

	test("accepts --from-ssh private key and writes normalized .pub file", async () => {
		const { deps, writes, infos } = makeDeps()

		await _runKeyAddCommand("alice", { fromSsh: "~/.ssh/id_ed25519" }, deps)

		expect(writes.has(path.join("/workspace", ".dotenc", "alice.pub"))).toBe(
			true,
		)
		expect(
			infos.some((message) => message.includes("added successfully")),
		).toBe(true)
	})

	test("falls back to parsed OpenSSH private key for --from-ssh", async () => {
		const { privateKey } = crypto.generateKeyPairSync("ed25519")
		const privatePem = privateKey
			.export({ type: "pkcs8", format: "pem" })
			.toString("utf-8")

		const { deps, writes } = makeDeps({
			readFile: (async () => "OPENSSH-PRIVATE-KEY") as never,
			createPrivateKey: () => {
				throw new Error("parse failed")
			},
			parseOpenSSHPrivateKey: () => crypto.createPrivateKey(privatePem),
		})

		await _runKeyAddCommand("alice", { fromSsh: "~/.ssh/id_ed25519" }, deps)

		expect(writes.size).toBe(1)
	})

	test("uses public-key fallback when --from-ssh private key parse fails", async () => {
		const { publicKey } = crypto.generateKeyPairSync("ed25519")
		const publicPem = publicKey
			.export({ type: "spki", format: "pem" })
			.toString("utf-8")

		const { deps, writes } = makeDeps({
			readFile: (async () => publicPem) as never,
			createPrivateKey: () => {
				throw new Error("not a private key")
			},
			parseOpenSSHPrivateKey: () => null,
		})

		await _runKeyAddCommand("alice", { fromSsh: "~/.ssh/id_ed25519" }, deps)

		expect(writes.size).toBe(1)
	})

	test("logs details when --from-ssh content is invalid", async () => {
		const { deps, errors } = makeDeps({
			readFile: (async () => "not a key") as never,
			createPrivateKey: () => {
				throw new Error("private parse failed")
			},
			createPublicKey: () => {
				throw new Error("public parse failed")
			},
			parseOpenSSHPrivateKey: () => null,
		})

		await expect(
			_runKeyAddCommand("alice", { fromSsh: "~/.ssh/id_ed25519" }, deps),
		).rejects.toThrow("exit(1)")

		expect(
			errors.some((message) => message.includes("Invalid SSH key format")),
		).toBe(true)
		expect(
			errors.some((message) => message.includes("public parse failed")),
		).toBe(true)
	})

	test("rejects when --from-file path does not exist", async () => {
		const { deps } = makeDeps({
			existsSync: (filePath) =>
				String(filePath) === path.join("/workspace", ".dotenc"),
		})

		await expect(
			_runKeyAddCommand("alice", { fromFile: "/tmp/missing.pem" }, deps),
		).rejects.toThrow("exit(1)")
	})

	test("rejects passphrase-protected --from-file keys", async () => {
		const { privateKey } = crypto.generateKeyPairSync("ed25519")
		const privatePem = privateKey
			.export({ type: "pkcs8", format: "pem" })
			.toString("utf-8")
		const fromFilePath = "/tmp/key.pem"

		const { deps } = makeDeps({
			existsSync: (filePath) =>
				String(filePath) === path.join("/workspace", ".dotenc") ||
				String(filePath) === fromFilePath,
			readFile: (async () => privatePem) as never,
			isPassphraseProtected: () => true,
		})

		await expect(
			_runKeyAddCommand("alice", { fromFile: fromFilePath }, deps),
		).rejects.toThrow("exit(1)")
	})

	test("falls back to private key parse for --from-file", async () => {
		const { privateKey } = crypto.generateKeyPairSync("ed25519")
		const privatePem = privateKey
			.export({ type: "pkcs8", format: "pem" })
			.toString("utf-8")
		const fromFilePath = "/tmp/key.pem"
		const originalCreatePublicKey = crypto.createPublicKey

		let publicKeyCalls = 0
		const { deps, writes } = makeDeps({
			existsSync: (filePath) =>
				String(filePath) === path.join("/workspace", ".dotenc") ||
				String(filePath) === fromFilePath,
			readFile: (async () => privatePem) as never,
			createPublicKey: ((input: string | crypto.KeyObject) => {
				publicKeyCalls += 1
				if (publicKeyCalls === 1) {
					throw new Error("not public pem")
				}
				return originalCreatePublicKey(input)
			}) as never,
		})

		await _runKeyAddCommand("alice", { fromFile: fromFilePath }, deps)

		expect(writes.size).toBe(1)
	})

	test("falls back to OpenSSH parser for --from-file", async () => {
		const { privateKey } = crypto.generateKeyPairSync("ed25519")
		const privatePem = privateKey
			.export({ type: "pkcs8", format: "pem" })
			.toString("utf-8")
		const fromFilePath = "/tmp/key.pem"
		const originalCreatePublicKey = crypto.createPublicKey
		let createPublicKeyCalls = 0

		const { deps, writes } = makeDeps({
			existsSync: (filePath) =>
				String(filePath) === path.join("/workspace", ".dotenc") ||
				String(filePath) === fromFilePath,
			readFile: (async () => "OPENSSH PRIVATE KEY") as never,
			createPublicKey: ((input: string | crypto.KeyObject) => {
				createPublicKeyCalls += 1
				if (createPublicKeyCalls === 1) {
					throw new Error("bad public key")
				}
				return originalCreatePublicKey(input)
			}) as never,
			createPrivateKey: () => {
				throw new Error("bad private key")
			},
			parseOpenSSHPrivateKey: () => crypto.createPrivateKey(privatePem),
		})

		await _runKeyAddCommand("alice", { fromFile: fromFilePath }, deps)

		expect(writes.size).toBe(1)
	})

	test("rejects invalid --from-file content", async () => {
		const fromFilePath = "/tmp/key.pem"
		const { deps, errors } = makeDeps({
			existsSync: (filePath) =>
				String(filePath) === path.join("/workspace", ".dotenc") ||
				String(filePath) === fromFilePath,
			readFile: (async () => "not a key") as never,
			createPublicKey: () => {
				throw new Error("bad public key")
			},
			createPrivateKey: () => {
				throw new Error("bad private key")
			},
			parseOpenSSHPrivateKey: () => null,
		})

		await expect(
			_runKeyAddCommand("alice", { fromFile: fromFilePath }, deps),
		).rejects.toThrow("exit(1)")

		expect(
			errors.some((message) => message.includes("Invalid key format")),
		).toBe(true)
	})

	test("rejects invalid --from-string content", async () => {
		const { deps } = makeDeps({
			createPublicKey: () => {
				throw new Error("bad public key")
			},
			createPrivateKey: () => {
				throw new Error("bad private key")
			},
			parseOpenSSHPrivateKey: () => null,
		})

		await expect(
			_runKeyAddCommand("alice", { fromString: "invalid" }, deps),
		).rejects.toThrow("exit(1)")
	})

	test("supports --from-string private keys", async () => {
		const { privateKey } = crypto.generateKeyPairSync("ed25519")
		const privatePem = privateKey
			.export({ type: "pkcs8", format: "pem" })
			.toString("utf-8")
		const originalCreatePublicKey = crypto.createPublicKey

		let call = 0
		const { deps, writes } = makeDeps({
			createPublicKey: ((input: string | crypto.KeyObject) => {
				call += 1
				if (call === 1) {
					throw new Error("not a public pem")
				}
				return originalCreatePublicKey(input)
			}) as never,
		})

		await _runKeyAddCommand("alice", { fromString: privatePem }, deps)

		expect(writes.size).toBe(1)
	})

	test("interactive paste mode rejects empty input", async () => {
		const { deps } = makeDeps({
			prompt: mock(async () => ({ mode: "paste" })) as never,
			inputKeyPrompt: mock(async () => "") as never,
		})

		await expect(_runKeyAddCommand(undefined, undefined, deps)).rejects.toThrow(
			"exit(1)",
		)
	})

	test("interactive choose mode handles prompt errors", async () => {
		const { deps } = makeDeps({
			prompt: mock(async () => ({ mode: "choose" })) as never,
			choosePrivateKeyPrompt: mock(async () => {
				throw new Error("No private keys found")
			}) as never,
		})

		await expect(_runKeyAddCommand(undefined, undefined, deps)).rejects.toThrow(
			"exit(1)",
		)
	})

	test("interactive choose mode uses selected key name when CLI name is missing", async () => {
		const { privateKey } = crypto.generateKeyPairSync("ed25519")
		const { deps, writes } = makeDeps({
			prompt: mock(async () => ({ mode: "choose" })) as never,
			choosePrivateKeyPrompt: mock(async () => ({
				name: "selected_name",
				privateKey,
				fingerprint: "fingerprint",
				algorithm: "ed25519",
				rawSeed: Buffer.alloc(32),
				rawPublicKey: Buffer.alloc(32),
			})) as never,
		})

		await _runKeyAddCommand(undefined, undefined, deps)

		expect(
			writes.has(path.join("/workspace", ".dotenc", "selected_name.pub")),
		).toBe(true)
	})

	test("rejects when public key validation fails", async () => {
		const { deps } = makeDeps({
			validatePublicKey: () => ({
				valid: false,
				reason: "Invalid key: RSA key is too weak",
			}),
		})

		await expect(
			_runKeyAddCommand("alice", { fromString: "anything" }, deps),
		).rejects.toThrow("exit(1)")
	})

	test("rejects invalid normalized key names", async () => {
		const { deps } = makeDeps({
			validateKeyName: () => ({
				valid: false,
				reason: "invalid key name",
			}),
		})

		await expect(
			_runKeyAddCommand("invalid/../name", { fromString: "anything" }, deps),
		).rejects.toThrow("exit(1)")
	})

	test("creates .dotenc directory when absent", async () => {
		const { deps, createdDirs } = makeDeps({
			existsSync: (filePath) => {
				const normalized = String(filePath)
				return normalized === path.join("/home/tester", ".ssh", "id_ed25519")
			},
		})

		await _runKeyAddCommand("alice", { fromSsh: "~/.ssh/id_ed25519" }, deps)

		expect(createdDirs.has(path.join("/workspace", ".dotenc"))).toBe(true)
	})

	test("rejects duplicate key names", async () => {
		const duplicatePath = path.join("/workspace", ".dotenc", "alice.pub")
		const { deps } = makeDeps({
			existsSync: (filePath) => {
				const normalized = String(filePath)
				return (
					normalized === path.join("/workspace", ".dotenc") ||
					normalized === duplicatePath
				)
			},
		})

		await expect(
			_runKeyAddCommand("alice", { fromString: "anything" }, deps),
		).rejects.toThrow("exit(1)")
	})
})
