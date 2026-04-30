import { readFileSync, writeFileSync } from "node:fs"
import { execSync } from "node:child_process"
import { basename, extname, dirname, resolve } from "node:path"
import compile from "./compiler.js"

const source = process.argv[2]
if (!source) {
  console.error("Usage: node src/salamis.js <file.sal>")
  process.exit(1)
}

const sourceCode = readFileSync(source, "utf-8")
const sourceDir  = dirname(resolve(source))
const needsHtml  = /\b(plot|histogram)\s*\(/.test(sourceCode)
const stem       = basename(source, extname(source))

// Always compile original source to JS and run it for terminal output.
// The generated JS uses __readCsv with Node's fs module at runtime.
// Write the JS next to the source file and run from there so relative
// paths (like readCsv("prices.csv")) resolve against the source directory.
const js = compile(sourceCode, "js")
const jsFile = resolve(sourceDir, stem + ".js")
writeFileSync(jsFile, js)
execSync(`node "${jsFile}"`, { stdio: "inherit", cwd: sourceDir })

if (needsHtml) {
  // Generate HTML from original source, then post-process to inline CSV data
  // so the HTML is self-contained and works in the browser without Node's fs.
  let html = compile(sourceCode, "html")
  html = inlineCsvInHtml(html, sourceDir)
  const htmlFile = resolve(sourceDir, stem + ".html")
  writeFileSync(htmlFile, html)
  console.log(`Chart written: ${htmlFile}`)
  try {
    const open = process.platform === "win32" ? "start" : process.platform === "darwin" ? "open" : "xdg-open"
    execSync(`${open} "${htmlFile}"`, { stdio: "ignore" })
  } catch { /* silently skip if browser open fails */ }
}

// ---------------------------------------------------------------------------
// Post-process the generated HTML/JS string to replace __readCsv("file.csv")
// calls with inline 2D array literals so the HTML is fully self-contained.
// ---------------------------------------------------------------------------
function inlineCsvInHtml(html, dir) {
  return html.replace(/__readCsv\("([^"]+)"\)/g, (_match, csvPath) => {
    const fullPath = resolve(dir, csvPath)
    const lines = readFileSync(fullPath, "utf-8").trim().split(/\r?\n/)
    const hasHeader = isNaN(parseFloat(lines[0].split(",")[0]))
    const rows = (hasHeader ? lines.slice(1) : lines)
      .map(row => `[${row.split(",").map(s => String(parseFloat(s.trim()))).join(", ")}]`)
    return `[${rows.join(", ")}]`
  })
}
