import { readFileSync, writeFileSync } from "node:fs"
import { execSync } from "node:child_process"
import { basename, extname } from "node:path"
import compile from "./compiler.js"

const source = process.argv[2]
if (!source) {
  console.error("Usage: node src/salamis.js <file.sal>")
  process.exit(1)
}

const sourceCode = readFileSync(source, "utf-8")
const needsHtml = /\bplot\s*\(/.test(sourceCode)
const stem = basename(source, extname(source))

if (needsHtml) {
  const html = compile(sourceCode, "html")
  const outFile = stem + ".html"
  writeFileSync(outFile, html)
  console.log(`Written: ${outFile}`)
  // Open in default browser (cross-platform best-effort)
  try {
    const open = process.platform === "win32" ? "start" : process.platform === "darwin" ? "open" : "xdg-open"
    execSync(`${open} "${outFile}"`, { stdio: "ignore" })
  } catch { /* silently skip if browser open fails */ }
} else {
  const js = compile(sourceCode, "js")
  const outFile = stem + ".js"
  writeFileSync(outFile, js)
  execSync(`node ${outFile}`, { stdio: "inherit" })
}
