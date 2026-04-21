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

// Always run the JS so print() output appears in the terminal
const js = compile(sourceCode, "js")
const jsFile = stem + ".js"
writeFileSync(jsFile, js)
execSync(`node ${jsFile}`, { stdio: "inherit" })

if (needsHtml) {
  const html = compile(sourceCode, "html")
  const htmlFile = stem + ".html"
  writeFileSync(htmlFile, html)
  console.log(`Chart written: ${htmlFile}`)
  try {
    const open = process.platform === "win32" ? "start" : process.platform === "darwin" ? "open" : "xdg-open"
    execSync(`${open} "${htmlFile}"`, { stdio: "ignore" })
  } catch { /* silently skip if browser open fails */ }
}
