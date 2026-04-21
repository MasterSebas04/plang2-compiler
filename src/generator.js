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
}`

export default function generate(program) {
  const output = []

  // Greek and other non-JS identifiers get suffixed with _1, _2, etc.
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
      const op = { "==": "===", "!=": "!==" }[e.operator] ?? e.operator
      return `(${gen(e.left)} ${op} ${gen(e.right)})`
    },

    UnaryExpression(e) {
      return `(-(${gen(e.argument)}))`
    },

    // Pipe: left |> right becomes right(left)
    PipeExpression(e) {
      return `${gen(e.right)}(${gen(e.left)})`
    },

    // Matrix multiply: uses a runtime helper emitted at the top of output
    MatmulExpression(e) {
      return `__matmul(${gen(e.left)}, ${gen(e.right)})`
    },

    // Slice by range emits .slice(from, to); slice by index emits [index]
    SliceExpression(e) {
      if (e.index?.kind === "RangeExpression") {
        return `${gen(e.target)}.slice(${gen(e.index.from)}, ${gen(e.index.to)})`
      }
      return `${gen(e.target)}[${gen(e.index)}]`
    },

    RangeExpression(e) {
      // Ranges used standalone (for loops) are handled in ForRangeStatement.
      // This covers range used as a slice index.
      return `${gen(e.from)}, ${gen(e.to)}`
    },

    FunctionCall(c) {
      const args = c.arguments.map(gen).join(", ")
      const call = `${gen(c.callee)}(${args})`
      // Void calls are statements; non-void are expressions
      if (c.type?.kind === "Void") {
        output.push(`${call};`)
        return
      }
      return call
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
  return output.join("\n")
}
