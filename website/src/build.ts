import { cpSync, existsSync, mkdirSync, rmSync, readFileSync, writeFileSync } from "fs"
import { join } from "path"
import { $ } from "bun"

const ROOT = join(import.meta.dir, "..")
const SRC = join(ROOT, "src")
const PUBLIC = join(ROOT, "public")
const DIST = join(ROOT, "dist")

// Clean dist/
if (existsSync(DIST)) {
	rmSync(DIST, { recursive: true })
}
mkdirSync(DIST, { recursive: true })

// Build + minify CSS with Tailwind
console.log("🎨 Building CSS...")
await $`bunx @tailwindcss/cli -i ${join(SRC, "styles/main.css")} -o ${join(DIST, "styles.css")} --minify`

// Copy index.html
console.log("📄 Copying HTML...")
let html = readFileSync(join(SRC, "index.html"), "utf-8")
// Update CSS path for production (dev uses public/styles.css)
html = html.replace("/styles.css", "./styles.css")
html = html.replace("/scripts/main.js", "./scripts/main.js")
writeFileSync(join(DIST, "index.html"), html)

// Copy JS
console.log("📦 Copying JS...")
mkdirSync(join(DIST, "scripts"), { recursive: true })
cpSync(join(SRC, "scripts"), join(DIST, "scripts"), { recursive: true })

// Copy public assets
console.log("📁 Copying public assets...")
cpSync(PUBLIC, DIST, { recursive: true })

console.log("✅ Build complete! Output in dist/")
