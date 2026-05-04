import * as readline from "node:readline/promises"
import * as vm from "node:vm"
import { writeFileSync, readFileSync } from "node:fs"
import { spawn } from "node:child_process"
import { resolve } from "node:path"
import parse from "./parser.js"
import analyze, { Context } from "./analyzer.js"
import optimize from "./optimizer.js"
import { generateRepl, replPreamble, buildReplHtml } from "./generator.js"
import * as core from "./core.js"

function inlineCsv(js) {
  return js.replace(/__readCsv\("([^"]+)"\)/g, (_match, csvPath) => {
    const lines = readFileSync(resolve(csvPath), "utf-8").trim().split(/\r?\n/)
    const hasHeader = isNaN(parseFloat(lines[0].split(",")[0]))
    const rows = (hasHeader ? lines.slice(1) : lines)
      .map(row => `[${row.split(",").map(s => String(parseFloat(s.trim()))).join(", ")}]`)
    return `[${rows.join(", ")}]`
  })
}

export default async function startRepl() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

  const vmCtx = vm.createContext({ console, Math, Array, String, Number, JSON, isNaN, parseFloat, parseInt, Infinity, NaN, __readFileSync: readFileSync })
  vm.runInContext(replPreamble, vmCtx)

  const replContext = new Context()
  for (const [name, fun] of core.builtins) {
    replContext.set(name, fun, { getLineAndColumnMessage: () => "" })
  }

  const nameMap = new Map()
  let buffer = ""
  let jsHistory = ""
  const plotHistory = []

  console.log("Salamis REPL  (Ctrl+C to exit)\n")

  while (true) {
    const prompt = buffer ? "... " : ">>> "
    let line
    try {
      line = await rl.question(prompt)
    } catch {
      break
    }

    buffer += line + "\n"

    const opens = (buffer.match(/\{/g) ?? []).length
    const closes = (buffer.match(/\}/g) ?? []).length
    if (opens > closes) continue

    const source = buffer
    buffer = ""

    try {
      const match = parse(source)
      const analyzed = analyze(match, replContext)
      const optimized = optimize(analyzed)
      const { js, plotItems } = generateRepl(optimized, nameMap)

      if (js.trim()) {
        vm.runInContext(js, vmCtx)
        jsHistory += js + "\n"
      }

      if (plotItems.length > 0) {
        plotHistory.push(...plotItems)
        const safeJs = inlineCsv(replPreamble + "\n" + jsHistory)
        const html = buildReplHtml(safeJs, plotHistory)
        const htmlFile = resolve("repl_chart.html")
        writeFileSync(htmlFile, html)
        console.log(`Chart written: ${htmlFile}`)
        try {
          if (process.platform === "win32") {
            spawn("rundll32.exe", ["url.dll,FileProtocolHandler", htmlFile], { windowsHide: true, stdio: "ignore", detached: true }).unref()
          } else {
            spawn(process.platform === "darwin" ? "open" : "xdg-open", [htmlFile], { stdio: "ignore", detached: true }).unref()
          }
        } catch { /* silently skip if browser open fails */ }
      }
    } catch (e) {
      console.error(e.message.split("\n")[0])
    }
  }

  rl.close()
}
