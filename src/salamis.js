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

// Future: detect plot() calls and switch to HTML emission
const needsHtml = false

if (needsHtml) {
  // HTML emission for Chart.js visualization — not yet implemented
  throw new Error("HTML output not yet implemented")
} else {
  const js = compile(sourceCode, "js")
  const outFile = basename(source, extname(source)) + ".js"
  writeFileSync(outFile, js)
  execSync(`node ${outFile}`, { stdio: "inherit" })
}
