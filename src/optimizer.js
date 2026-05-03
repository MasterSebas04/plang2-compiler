import * as core from "./core.js"

export default function optimize(node) {
  const handler = optimizers[node?.kind]
  return handler ? handler(node) : node
}

function optimizeBlock(stmts) {
  const result = []
  for (const stmt of stmts) {
    const opt = optimize(stmt)
    if (opt === null) continue
    if (opt.kind === "_Inline") {
      result.push(...opt.stmts)
    } else {
      result.push(opt)
      if (opt.kind === "ReturnStatement") break
    }
  }
  return result
}

function isInt(n)     { return n.kind === "IntLiteral" }
function isFloat(n)   { return n.kind === "FloatLiteral" }
function isNumLit(n)  { return isInt(n) || isFloat(n) }
function isBoolLit(n) { return n.kind === "BoolLiteral" }
function isVec(n)     { return (n.type ?? n)?.kind === "Vec" }

function numLit(value, like) {
  return isFloat(like) ? core.floatLiteral(value) : core.intLiteral(value)
}

function zeroOf(type) {
  return type.kind === "Float" ? core.floatLiteral(0) : core.intLiteral(0)
}

function sameVar(a, b) {
  return a.kind === "Variable" && b.kind === "Variable" && a === b
}

const optimizers = {
  Program(p) {
    return core.program(optimizeBlock(p.body))
  },

  LetStatement(s) {
    return core.letStmt(s.variable, optimize(s.initializer))
  },

  AssignStatement(s) {
    return core.assignStmt(s.target, optimize(s.source))
  },

  PrintStatement(s) {
    return core.printStmt(optimize(s.exp))
  },

  PlotStatement(s) {
    return core.plotStmt(s.exps.map(optimize))
  },

  HistogramStatement(s) {
    return core.histogramStmt(optimize(s.exp))
  },

  SimulateExpression(e) {
    return core.simulateExpr(optimize(e.count), optimize(e.body), e.type)
  },

  ReturnStatement(s) {
    return core.returnStmt(optimize(s.exp))
  },

  FunctionDeclaration(d) {
    return core.functionDecl(d.function, optimizeBlock(d.body))
  },

  IfStatement(s) {
    const test = optimize(s.test)
    if (isBoolLit(test)) {
      const branch = test.value ? s.consequent : s.alternate
      return { kind: "_Inline", stmts: optimizeBlock(branch) }
    }
    return core.ifStmt(test, optimizeBlock(s.consequent), optimizeBlock(s.alternate))
  },

  WhileStatement(s) {
    const test = optimize(s.test)
    if (isBoolLit(test) && !test.value) return null
    return core.whileStmt(test, optimizeBlock(s.body))
  },

  ForRangeStatement(s) {
    return core.forRangeStmt(s.id, optimize(s.range), optimizeBlock(s.body))
  },

  ForCollectionStatement(s) {
    return core.forCollectionStmt(s.id, optimize(s.iter), optimizeBlock(s.body))
  },

  BinaryExpression(e) {
    const l = optimize(e.left)
    const r = optimize(e.right)

    if (isNumLit(l) && isNumLit(r)) {
      switch (e.operator) {
        case "+":  return numLit(l.value + r.value, l)
        case "-":  return numLit(l.value - r.value, l)
        case "*":  return numLit(l.value * r.value, l)
        case "/":  return numLit(l.value / r.value, l)
        case "<":  return core.boolLiteral(l.value <  r.value)
        case ">":  return core.boolLiteral(l.value >  r.value)
        case "<=": return core.boolLiteral(l.value <= r.value)
        case ">=": return core.boolLiteral(l.value >= r.value)
        case "==": return core.boolLiteral(l.value === r.value)
        case "!=": return core.boolLiteral(l.value !== r.value)
      }
    }

    if (isBoolLit(l) && isBoolLit(r)) {
      if (e.operator === "==") return core.boolLiteral(l.value === r.value)
      if (e.operator === "!=") return core.boolLiteral(l.value !== r.value)
    }

    if (e.operator === "+") {
      if (isNumLit(r) && r.value === 0) return l
      if (isNumLit(l) && l.value === 0) return r
    }

    if (e.operator === "-") {
      if (isNumLit(r) && r.value === 0) return l
      // x - x only folds for scalars — Vec would need a zero-vector of unknown length
      if (sameVar(l, r) && !isVec(l)) return zeroOf(l.type)
    }

    if (e.operator === "*") {
      if (isNumLit(r) && r.value === 1) return l
      if (isNumLit(l) && l.value === 1) return r
      // x * 0 only folds for scalars — Vec would need a zero-vector literal
      if (isNumLit(r) && r.value === 0 && !isVec(l)) return numLit(0, r)
      if (isNumLit(l) && l.value === 0 && !isVec(r)) return numLit(0, l)
    }

    if (e.operator === "/") {
      if (isNumLit(r) && r.value === 1) return l
    }

    return core.binaryExp(l, e.operator, r, e.type)
  },

  UnaryExpression(e) {
    const arg = optimize(e.argument)
    if (isNumLit(arg)) return numLit(-arg.value, arg)
    return core.unaryExp(e.operator, arg, e.type)
  },

  PipeExpression(e) {
    return core.pipeExp(optimize(e.left), e.right, e.type)
  },

  RangeExpression(e) {
    return core.rangeExp(optimize(e.from), optimize(e.to))
  },

  FunctionCall(c) {
    return core.functionCall(c.callee, c.arguments.map(optimize), c.type)
  },

  VecLiteral(e) {
    return core.vecLiteral(e.elements.map(optimize), e.type)
  },

  MatmulExpression(e) {
    return core.matmulExp(optimize(e.left), optimize(e.right), e.type)
  },

  SliceExpression(e) {
    return core.sliceExp(optimize(e.target), optimize(e.index), e.type)
  },
}
