import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function readAttribute(attributes: string, name: string): string | null {
	const pattern = new RegExp(`${escapeRegExp(name)}=(["'])(.*?)\\1`)
	const match = attributes.match(pattern)
	return match ? match[2] : null
}

function withSvgAttribute(tag: string, name: string, value: string): string {
	const escapedValue = value.replace(/"/g, "&quot;")
	const pattern = new RegExp(`\\s${escapeRegExp(name)}=(["']).*?\\1`, "i")
	if (pattern.test(tag)) {
		return tag.replace(pattern, ` ${name}="${escapedValue}"`)
	}
	return tag.replace(/<svg\b/i, `<svg ${name}="${escapedValue}"`)
}

function withSvgClasses(tag: string, className: string): string {
	if (!className.trim()) return tag
	const match = tag.match(/\sclass=(["'])(.*?)\1/i)
	if (!match) {
		return withSvgAttribute(tag, "class", className.trim())
	}

	const existing = match[2].trim()
	const merged = `${existing} ${className}`.trim().replace(/\s+/g, " ")
	return withSvgAttribute(tag, "class", merged)
}

export function inlineSvgPlaceholders(html: string, publicDir: string): string {
	return html.replace(
		/<span([^>]*?)data-inline-svg=(["'])(.*?)\2([^>]*)><\/span>/g,
		(full, before, _quote, primary, after) => {
			const attributes = `${before}${after}`
			const fallback = readAttribute(attributes, "data-inline-svg-fallback")
			const className = readAttribute(attributes, "class") ?? ""
			const ariaHidden = readAttribute(attributes, "aria-hidden")
			const candidates = [primary, fallback]
				.filter(Boolean)
				.map((path) => join(publicDir, path.replace(/^\/+/, "")))
			const svgPath = candidates.find((path) => existsSync(path))
			if (!svgPath) return full

			let svg = readFileSync(svgPath, "utf-8")
			svg = svg
				.replace(/^\uFEFF/, "")
				.replace(/<\?xml[\s\S]*?\?>\s*/i, "")
				.trim()

			const openTagMatch = svg.match(/<svg\b[^>]*>/i)
			if (!openTagMatch) return full

			let openTag = openTagMatch[0]
			openTag = openTag.replace(/\s(fill|width|height)=(["']).*?\2/gi, "")
			openTag = withSvgClasses(openTag, className)
			if (ariaHidden !== null) {
				openTag = withSvgAttribute(openTag, "aria-hidden", ariaHidden)
			}

			svg = svg.replace(openTagMatch[0], openTag)
			svg = svg.replace(/\sfill=(["']).*?\1/gi, "")
			return svg
		},
	)
}
