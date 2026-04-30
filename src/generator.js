// Maps Salamis builtin names to their JS equivalents
const jsBuiltins = new Map([
  ["sqrt",  "Math.sqrt"],
  ["log",   "Math.log"],
  ["log2",  "Math.log2"],
  ["log10", "Math.log10"],
  ["abs",   "Math.abs"],
  ["exp",   "Math.exp"],
  ["floor", "Math.floor"],
  ["ceil",  "Math.ceil"],
  ["round", "Math.round"],
  ["sin",   "Math.sin"],
  ["cos",   "Math.cos"],
  ["pow",   "Math.pow"],
  ["len",      "__len"],
  ["sum",      "__sum"],
  ["mean",     "__mean"],
  ["max",      "__max"],
  ["min",      "__min"],
  ["Normal",   "__Normal"],
  ["Bernoulli","__Bernoulli"],
  ["Poisson",  "__Poisson"],
  ["Uniform",  "__Uniform"],
  ["sample",   "__sample"],
  ["readCsv",  "__readCsv"],
  ["col",      "__col"],
  ["str",      "__str"],
  ["format",   "__format"],
])

const builtinPreamble = `\
function __len(v) { return v.length }
function __sum(v) { return v.reduce((a, b) => a + b, 0) }
function __mean(v) { return __sum(v) / v.length }
function __max(v) { return Math.max(...v) }
function __min(v) { return Math.min(...v) }
function __Normal(mu, sigma) { return { kind: "Normal", mu, sigma } }
function __Bernoulli(p) { return { kind: "Bernoulli", p } }
function __Poisson(lambda) { return { kind: "Poisson", lambda } }
function __Uniform(a, b) { return { kind: "Uniform", a, b } }
function __sample(d) {
  if (d.kind === "Normal") {
    const u1 = Math.random(), u2 = Math.random()
    return d.mu + d.sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  }
  if (d.kind === "Bernoulli") return Math.random() < d.p ? 1.0 : 0.0
  if (d.kind === "Poisson") {
    const L = Math.exp(-d.lambda)
    let k = 0, p = 1.0
    do { k++; p *= Math.random() } while (p > L)
    return k - 1
  }
  if (d.kind === "Uniform") return d.a + Math.random() * (d.b - d.a)
  throw new Error("Unknown distribution: " + d.kind)
}
// CSV helpers — __readCsv returns a 2D array (Matrix<Float>).
// __readFileSync is injected as an ES module import when CSV is used.
// If the first row's first cell isn't a number it's treated as a header and skipped.
function __readCsv(path) {
  const lines = __readFileSync(path, "utf-8").trim().split(/\\r?\\n/)
  const hasHeader = isNaN(parseFloat(lines[0].split(",")[0]))
  return (hasHeader ? lines.slice(1) : lines)
    .map(row => row.split(",").map(s => parseFloat(s.trim())))
}
function __col(m, n) { return m.map(row => row[n]) }
function __str(x) { return String(x) }
function __format(x, n) { return x.toFixed(n) }`

// Single generation pass — returns { js, plotItems }
// plotItems is an array of { expr, type } where type is "line" or "histogram"
function runGeneration(program) {
  const output = []
  const plotItems = []

  const targetName = (mapping => {
    return entity => {
      if (!mapping.has(entity)) {
        mapping.set(entity, mapping.size + 1)
      }
      return `${entity.name}_${mapping.get(entity)}`
    }
  })(new Map())

  const gen = node => generators?.[node?.kind]?.(node) ?? node

  const generators = {
    Program(p) {
      p.body.forEach(gen)
    },

    LetStatement(s) {
      output.push(`let ${gen(s.variable)} = ${gen(s.initializer)};`)
    },

    AssignStatement(s) {
      output.push(`${gen(s.target)} = ${gen(s.source)};`)
    },

    PrintStatement(s) {
      output.push(`console.log(${gen(s.exp)});`)
    },

    PlotStatement(s) {
      plotItems.push({ exprs: s.exps.map(gen), type: "line" })
    },

    HistogramStatement(s) {
      plotItems.push({ exprs: [gen(s.exp)], type: "histogram" })
    },

    ReturnStatement(s) {
      output.push(`return ${gen(s.exp)};`)
    },

    FunctionDeclaration(d) {
      output.push(`function ${gen(d.function)}(${d.function.params.map(gen).join(", ")}) {`)
      d.body.forEach(gen)
      output.push("}")
    },

    FunctionObject(f) {
      if (jsBuiltins.has(f.name)) return jsBuiltins.get(f.name)
      return targetName(f)
    },

    Variable(v) {
      return targetName(v)
    },

    Param(p) {
      return targetName(p)
    },

    IfStatement(s) {
      output.push(`if (${gen(s.test)}) {`)
      s.consequent.forEach(gen)
      if (s.alternate.length === 1 && s.alternate[0]?.kind === "IfStatement") {
        output.push("} else")
        gen(s.alternate[0])
      } else if (s.alternate.length > 0) {
        output.push("} else {")
        s.alternate.forEach(gen)
        output.push("}")
      } else {
        output.push("}")
      }
    },

    WhileStatement(s) {
      output.push(`while (${gen(s.test)}) {`)
      s.body.forEach(gen)
      output.push("}")
    },

    ForRangeStatement(s) {
      const i = targetName(s.id)
      const from = gen(s.range.from)
      const to = gen(s.range.to)
      output.push(`for (let ${i} = ${from}; ${i} < ${to}; ${i}++) {`)
      s.body.forEach(gen)
      output.push("}")
    },

    ForCollectionStatement(s) {
      output.push(`for (const ${gen(s.id)} of ${gen(s.iter)}) {`)
      s.body.forEach(gen)
      output.push("}")
    },

    BinaryExpression(e) {
      const l = gen(e.left)
      const r = gen(e.right)
      const op = { "==": "===", "!=": "!==" }[e.operator] ?? e.operator

      // Element-wise Vec operations — use __v/__i as lambda params to avoid
      // shadowing any user variable that happens to be named the same.
      if (e.type?.kind === "Vec") {
        const lIsVec = (e.left.type ?? e.left)?.kind === "Vec"
        const rIsVec = (e.right.type ?? e.right)?.kind === "Vec"
        if (lIsVec && rIsVec) return `${l}.map((__v, __i) => __v ${op} ${r}[__i])`
        if (lIsVec)           return `${l}.map(__v => __v ${op} ${r})`
        /* scalar op Vec */   return `${r}.map(__v => ${l} ${op} __v)`
      }

      return `(${l} ${op} ${r})`
    },

    UnaryExpression(e) {
      // Element-wise negation for Vec types
      if ((e.argument.type ?? e.argument)?.kind === "Vec") {
        return `${gen(e.argument)}.map(__v => -__v)`
      }
      return `(-(${gen(e.argument)}))`
    },

    PipeExpression(e) {
      return `${gen(e.right)}(${gen(e.left)})`
    },

    MatmulExpression(e) {
      return `__matmul(${gen(e.left)}, ${gen(e.right)})`
    },

    SliceExpression(e) {
      if (e.index?.kind === "RangeExpression") {
        return `${gen(e.target)}.slice(${gen(e.index.from)}, ${gen(e.index.to)})`
      }
      return `${gen(e.target)}[${gen(e.index)}]`
    },

    RangeExpression(e) {
      return `${gen(e.from)}, ${gen(e.to)}`
    },

    FunctionCall(c) {
      const args = c.arguments.map(gen).join(", ")
      const call = `${gen(c.callee)}(${args})`
      if (c.type?.kind === "Void") {
        output.push(`${call};`)
        return
      }
      return call
    },

    SimulateExpression(e) {
      return `Array.from({length: ${gen(e.count)}}, () => ${gen(e.body)})`
    },

    VecLiteral(e) {
      return `[${e.elements.map(gen).join(", ")}]`
    },

    IntLiteral(e) { return String(e.value) },
    FloatLiteral(e) { return Number.isInteger(e.value) ? e.value.toFixed(1) : String(e.value) },
    BoolLiteral(e) { return String(e.value) },
    StrLiteral(e) { return JSON.stringify(e.value) },
  }

  output.push(builtinPreamble)
  output.push(`function __matmul(A, B) {
  const rows = A.length, cols = B[0].length, inner = B.length;
  return Array.from({length: rows}, (_, r) =>
    Array.from({length: cols}, (_, c) =>
      Array.from({length: inner}, (_, k) => A[r][k] * B[k][c])
        .reduce((s, v) => s + v, 0)));
}`)

  gen(program)
  const body = output.join("\n")
  // Prepend the Node.js fs import only when readCsv is actually used.
  // The import must be at the top of the file; browsers never see it because
  // generateHtml strips it before embedding the script.
  const needsFs = body.includes("__readCsv")
  const header  = needsFs ? `import { readFileSync as __readFileSync } from 'node:fs'\n` : ""
  return { js: header + body, plotItems }
}

export default function generate(program) {
  return runGeneration(program).js
}

export function generateHtml(program) {
  let { js, plotItems } = runGeneration(program)
  // Strip the Node.js fs import — the browser can't use it, and CSV calls
  // will be replaced with inline literals by the CLI before the HTML is written.
  js = js.replace(/^import[^\n]+from ['"]node:fs['"]\n/m, "")

  // Color palette — cycles across all datasets across all charts
  const palette = [
    ["54, 162, 235"],
    ["255, 99, 132"],
    ["75, 192, 192"],
    ["255, 159, 64"],
    ["153, 102, 255"],
    ["255, 205, 86"],
    ["201, 203, 207"],
  ]
  let colorIdx = 0
  const nextColor = () => palette[colorIdx++ % palette.length][0]

  const canvases = plotItems
    .map((_, i) => `<canvas id="chart${i}" style="max-height:400px;margin-bottom:2rem"></canvas>`)
    .join("\n")

  const chartScripts = plotItems.map(({ exprs, type }, i) => {
    if (type === "histogram") {
      const color = nextColor()
      return `
  (function() {
    const _data = ${exprs[0]};
    const _n = _data.length;
    const _bins = Math.ceil(Math.log2(_n) + 1);
    const _lo = Math.min(..._data), _hi = Math.max(..._data);
    const _width = (_hi - _lo) / _bins || 1;
    const _counts = Array(_bins).fill(0);
    _data.forEach(v => {
      const b = Math.min(Math.floor((v - _lo) / _width), _bins - 1);
      _counts[b]++;
    });
    const _labels = Array.from({length: _bins}, (_, b) =>
      (_lo + b * _width).toFixed(2) + "–" + (_lo + (b + 1) * _width).toFixed(2));
    const ctx = document.getElementById('chart${i}').getContext('2d');
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: _labels,
        datasets: [{ label: 'Frequency', data: _counts, borderWidth: 1,
          backgroundColor: 'rgba(${color}, 0.7)', borderColor: 'rgb(${color})' }]
      },
      options: { responsive: true, plugins: { legend: { display: false } } }
    });
  })();`
    }
    const datasets = exprs.map((expr, j) => {
      const color = nextColor()
      return `{
        label: 'Series ${j + 1}',
        data: (function(){ return ${expr}; })(),
        borderColor: 'rgb(${color})',
        backgroundColor: 'rgba(${color}, 0.1)',
        borderWidth: 2,
        fill: false,
        tension: 0.1
      }`
    }).join(",\n        ")
    return `
  (function() {
    const _first = (function(){ return ${exprs[0]}; })();
    const ctx = document.getElementById('chart${i}').getContext('2d');
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: _first.map((_, i) => i),
        datasets: [${datasets}]
      },
      options: { responsive: true }
    });
  })();`
  }).join("\n")

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Salamis Output</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>body { font-family: sans-serif; max-width: 900px; margin: 2rem auto; padding: 1rem; }</style>
</head>
<body>
${canvases}
<script>
${js}
${chartScripts}
</script>
</body>
</html>`
}
