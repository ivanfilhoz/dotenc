import { execSync } from "node:child_process"
import { getHomeConfig } from "./homeConfig"

/**
 * Determines the default text editor for the system.
 * @returns {string} The command to launch the default text editor.
 */
export const getDefaultEditor = async () => {
	const config = await getHomeConfig()

	// Check the editor field in the config file
	if (config.editor) {
		return config.editor
	}

	// Check the EDITOR environment variable
	if (process.env.EDITOR) {
		return process.env.EDITOR
	}

	// Check the VISUAL environment variable
	if (process.env.VISUAL) {
		return process.env.VISUAL
	}
	// Platform-specific defaults
	const platform = process.platform

	if (platform === "win32") {
		// Windows: Use notepad as the fallback editor
		return "notepad"
	}

	// Linux/macOS: Try nano, vim, or vi
	const editors = ["nano", "vim", "vi"]
	for (const editor of editors) {
		try {
			// Check if the editor is available
			execSync(`command -v ${editor}`, { stdio: "ignore" })
			return editor // Return the first available editor
		} catch {
			// Ignore errors and try the next editor
		}
	}

	// If no editor is found, throw an error
	throw new Error(
		'No text editor found. Please set the EDITOR environment variable, configure an editor using "dotenc config editor <command>", or install a text editor (e.g., nano, vim, or notepad).',
	)
}
