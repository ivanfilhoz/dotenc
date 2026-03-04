import path from "node:path"

export const buildAncestorChain = (
	projectRoot: string,
	invocationDir: string,
): string[] => {
	const root = path.resolve(projectRoot)
	const leaf = path.resolve(invocationDir)

	if (leaf === root) {
		return [leaf]
	}

	if (!leaf.startsWith(root + path.sep)) {
		throw new Error(
			`Invocation directory "${leaf}" is not under project root "${root}".`,
		)
	}

	const dirs: string[] = [root]
	const relative = leaf.slice(root.length + 1)
	const parts = relative.split(path.sep)

	let current = root
	for (const part of parts) {
		current = path.join(current, part)
		dirs.push(current)
	}

	return dirs
}
