import { readFileSync, writeFileSync } from "node:fs"
import { execSync, spawn } from "node:child_process"
import { basename, extname, dirname, resolve } from "node:path"
import compile from "./compiler.js"

const args   = process.argv.slice(2)
const source = args.find(a => !a.startsWith("--"))
const stages = ["parsed", "analyzed", "optimized", "js"]
const flag   = args.find(a => a.startsWith("--"))?.slice(2)

if (flag === "repl") {
  const { default: startRepl } = await import("./repl.js")
  await startRepl()
  process.exit(0)
}

if (!source) {
  console.error("Usage: node src/salamis.js <file.sal> [--parsed|--analyzed|--optimized|--js]")
  console.error("       node src/salamis.js --repl")
  process.exit(1)
}
if (flag && !stages.includes(flag)) {
  console.error(`Unknown flag --${flag}. Valid flags: ${stages.map(s => "--" + s).join(", ")}`)
  process.exit(1)
}

const sourceCode = readFileSync(source, "utf-8")
const sourceDir  = dirname(resolve(source))
const needsHtml  = /\b(plot|histogram)\s*\(/.test(sourceCode)
const stem       = basename(source, extname(source))

if (flag && flag !== "js") {
  try {
    const result = compile(sourceCode, flag)
    console.log(typeof result === "string" ? result : JSON.stringify(result, null, 2))
  } catch (e) {
    console.error(e.message)
    process.exit(1)
  }
  process.exit(0)
}

const js = compile(sourceCode, "js")
const jsFile = resolve(sourceDir, stem + ".js")
writeFileSync(jsFile, js)
execSync(`node "${jsFile}"`, { stdio: "inherit", cwd: sourceDir })

if (needsHtml) {
  let html = compile(sourceCode, "html")
  html = inlineCsvInHtml(html, sourceDir)
  const htmlFile = resolve(sourceDir, stem + ".html")
  writeFileSync(htmlFile, html)
  console.log(`Chart written: ${htmlFile}`)
  try {
    openBrowser(htmlFile)
  } catch { /* silently skip if browser open fails */ }
}

function openBrowser(file) {
  if (process.platform === "win32") {
    spawn("rundll32.exe", ["url.dll,FileProtocolHandler", file], { windowsHide: true, stdio: "ignore", detached: true }).unref()
  } else {
    spawn(process.platform === "darwin" ? "open" : "xdg-open", [file], { stdio: "ignore", detached: true }).unref()
  }
}

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
