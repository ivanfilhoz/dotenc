import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

export const setupGitDiff = () => {
	// Append *.enc diff=dotenc to .gitattributes if not already present
	const gitattributesPath = path.join(process.cwd(), ".gitattributes")
	const marker = "*.enc diff=dotenc"

	let content = ""
	if (fs.existsSync(gitattributesPath)) {
		content = fs.readFileSync(gitattributesPath, "utf-8")
	}

	if (!content.includes(marker)) {
		const newline = content.length > 0 && !content.endsWith("\n") ? "\n" : ""
		fs.writeFileSync(gitattributesPath, `${content}${newline}${marker}\n`)
	}

	// Configure git diff driver locally
	spawnSync(
		"git",
		["config", "--local", "diff.dotenc.textconv", "dotenc textconv"],
		{
			stdio: "ignore",
		},
	)
}
