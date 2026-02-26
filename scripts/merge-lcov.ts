import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

type BranchTaken = number | null

type FileCoverage = {
	functions: Map<string, { line: number; hits: number }>
	lines: Map<number, number>
	branches: Map<string, { line: number; block: string; branch: string; taken: BranchTaken }>
}

const ensureFileCoverage = (
	store: Map<string, FileCoverage>,
	filePath: string,
): FileCoverage => {
	let record = store.get(filePath)
	if (!record) {
		record = {
			functions: new Map(),
			lines: new Map(),
			branches: new Map(),
		}
		store.set(filePath, record)
	}
	return record
}

const normalizeSourcePath = (input: string): string => {
	const value = input.replaceAll("\\", "/")

	if (value.startsWith("/app/cli/")) {
		return value.slice("/app/cli/".length)
	}

	const cliMarker = "/dotenc/cli/"
	const cliIndex = value.lastIndexOf(cliMarker)
	if (cliIndex >= 0) {
		return value.slice(cliIndex + cliMarker.length)
	}

	return value
}

const mergeTaken = (current: BranchTaken, next: BranchTaken): BranchTaken => {
	if (current === null) return next
	if (next === null) return current
	return current + next
}

const parseLcovInto = (
	store: Map<string, FileCoverage>,
	filePath: string,
) => {
	const content = readFileSync(filePath, "utf8")
	const lines = content.split(/\r?\n/)
	let currentFile: string | null = null

	for (const line of lines) {
		if (!line) continue

		if (line.startsWith("SF:")) {
			currentFile = normalizeSourcePath(line.slice(3))
			ensureFileCoverage(store, currentFile)
			continue
		}

		if (line === "end_of_record") {
			currentFile = null
			continue
		}

		if (!currentFile) {
			continue
		}

		const file = ensureFileCoverage(store, currentFile)

		if (line.startsWith("FN:")) {
			const payload = line.slice(3)
			const commaIndex = payload.indexOf(",")
			if (commaIndex === -1) continue
			const functionLine = Number(payload.slice(0, commaIndex))
			const name = payload.slice(commaIndex + 1)
			const existing = file.functions.get(name)
			if (!existing) {
				file.functions.set(name, {
					line: Number.isFinite(functionLine) ? functionLine : 0,
					hits: 0,
				})
			}
			continue
		}

		if (line.startsWith("FNDA:")) {
			const payload = line.slice(5)
			const commaIndex = payload.indexOf(",")
			if (commaIndex === -1) continue
			const hits = Number(payload.slice(0, commaIndex))
			const name = payload.slice(commaIndex + 1)
			const existing = file.functions.get(name)
			if (existing) {
				existing.hits += Number.isFinite(hits) ? hits : 0
			} else {
				file.functions.set(name, {
					line: 0,
					hits: Number.isFinite(hits) ? hits : 0,
				})
			}
			continue
		}

		if (line.startsWith("DA:")) {
			const payload = line.slice(3)
			const [lineNoRaw, hitsRaw] = payload.split(",", 3)
			const lineNo = Number(lineNoRaw)
			const hits = Number(hitsRaw)
			if (!Number.isFinite(lineNo) || !Number.isFinite(hits)) continue
			file.lines.set(lineNo, (file.lines.get(lineNo) ?? 0) + hits)
			continue
		}

		if (line.startsWith("BRDA:")) {
			const payload = line.slice(5)
			const [lineNoRaw, block, branch, takenRaw] = payload.split(",", 4)
			const lineNo = Number(lineNoRaw)
			if (!Number.isFinite(lineNo) || block === undefined || branch === undefined) {
				continue
			}
			const key = `${lineNo}:${block}:${branch}`
			const taken = takenRaw === "-" || takenRaw === undefined ? null : Number(takenRaw)
			const parsedTaken =
				taken === null || Number.isFinite(taken) ? taken : null
			const existing = file.branches.get(key)
			if (existing) {
				existing.taken = mergeTaken(existing.taken, parsedTaken)
			} else {
				file.branches.set(key, {
					line: lineNo,
					block,
					branch,
					taken: parsedTaken,
				})
			}
			continue
		}
	}
}

const countCovered = (values: Iterable<number>): number => {
	let covered = 0
	for (const hits of values) {
		if (hits > 0) covered += 1
	}
	return covered
}

const writeMergedLcov = (
	outputFile: string,
	store: Map<string, FileCoverage>,
) => {
	const output: string[] = []
	const files = [...store.keys()].sort()

	for (const filePath of files) {
		const file = store.get(filePath)
		if (!file) continue

		output.push("TN:")
		output.push(`SF:${filePath}`)

		const functions = [...file.functions.entries()].sort((a, b) => {
			const lineDiff = a[1].line - b[1].line
			return lineDiff !== 0 ? lineDiff : a[0].localeCompare(b[0])
		})
		for (const [name, meta] of functions) {
			output.push(`FN:${meta.line},${name}`)
		}
		for (const [name, meta] of functions) {
			output.push(`FNDA:${meta.hits},${name}`)
		}
		output.push(`FNF:${functions.length}`)
		output.push(`FNH:${countCovered(functions.map(([, meta]) => meta.hits))}`)

		const branches = [...file.branches.values()].sort((a, b) => {
			const lineDiff = a.line - b.line
			if (lineDiff !== 0) return lineDiff
			const blockDiff = a.block.localeCompare(b.block)
			if (blockDiff !== 0) return blockDiff
			return a.branch.localeCompare(b.branch)
		})
		for (const branch of branches) {
			output.push(
				`BRDA:${branch.line},${branch.block},${branch.branch},${branch.taken === null ? "-" : branch.taken}`,
			)
		}
		output.push(`BRF:${branches.length}`)
		output.push(
			`BRH:${branches.filter((branch) => branch.taken !== null && branch.taken > 0).length}`,
		)

		const coveredLines = [...file.lines.entries()].sort((a, b) => a[0] - b[0])
		for (const [lineNo, hits] of coveredLines) {
			output.push(`DA:${lineNo},${hits}`)
		}
		output.push(`LF:${coveredLines.length}`)
		output.push(`LH:${countCovered(coveredLines.map(([, hits]) => hits))}`)
		output.push("end_of_record")
	}

	mkdirSync(path.dirname(outputFile), { recursive: true })
	writeFileSync(outputFile, `${output.join("\n")}\n`)
}

const args = process.argv.slice(2)
if (args.length < 3) {
	console.error(
		"Usage: bun scripts/merge-lcov.ts <output-lcov> <input-lcov> <input-lcov> [more...]",
	)
	process.exit(1)
}

const [outputFile, ...inputFiles] = args
const store = new Map<string, FileCoverage>()
for (const inputFile of inputFiles) {
	parseLcovInto(store, inputFile)
}
writeMergedLcov(outputFile, store)
