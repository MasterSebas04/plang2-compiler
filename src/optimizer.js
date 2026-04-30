import * as core from "./core.js"

// ---------------------------------------------------------------------------
// Optimizer — performs three classical AST-level optimizations:
//
//   1. Constant folding      — evaluate arithmetic/comparison expressions
//                              whose operands are all literals at compile time,
//                              so the runtime never has to do the work.
//
//   2. Dead code elimination — remove branches of an if-statement whose
//                              condition folds to a constant bool, and cut off
//                              any statements that follow a return in a block.
//                              A `for false { }` loop is also erased entirely.
//
//   3. Algebraic simplification — rewrite expressions using arithmetic
//                              identities: x+0→x, x*1→x, x*0→0, x/1→x,
//                              x-0→x, x-x→0. These often appear after
//                              constant folding produces a zero or one.
//
// The three passes interact: folding produces constants that simplification
// can act on; simplification produces constants that enable further folding;
// folding bool conditions enables dead code elimination.
// ---------------------------------------------------------------------------

export default function optimize(node) {
  // Use explicit handler lookup so a handler returning null isn't mistaken for
  // "no handler" — null ?? node would incorrectly substitute the original node.
  const handler = optimizers[node?.kind]
  return handler ? handler(node) : node
}

// ---------------------------------------------------------------------------
// Block-level optimizer
//
// Processes a statement array rather than a single node because two
// optimizations need to see the whole list:
//   - Dead code after return: once we hit a ReturnStatement we stop.
//   - Folded IfStatements: when a constant condition folds to one branch the
//     IfStatement optimizer returns a special _Inline marker so the statements
//     can be spliced into the parent block flat (avoiding a useless wrapper).
// ---------------------------------------------------------------------------
function optimizeBlock(stmts) {
  const result = []
  for (const stmt of stmts) {
    const opt = optimize(stmt)

    if (opt === null) continue  // e.g. a `for false {}` loop, eliminated

    if (opt.kind === "_Inline") {
      // Folded if-branch: splice its statements directly into this block
      result.push(...opt.stmts)
    } else {
      result.push(opt)
      // Dead code elimination: nothing after a return can ever execute
      if (opt.kind === "ReturnStatement") break
    }
  }
  return result
}

// ---------------------------------------------------------------------------
// Literal helpers
// ---------------------------------------------------------------------------

function isInt(n)     { return n.kind === "IntLiteral" }
function isFloat(n)   { return n.kind === "FloatLiteral" }
function isNumLit(n)  { return isInt(n) || isFloat(n) }
function isBoolLit(n) { return n.kind === "BoolLiteral" }
function isVec(n)     { return (n.type ?? n)?.kind === "Vec" }

// Build a numeric literal with the same Int/Float kind as `like`
function numLit(value, like) {
  return isFloat(like) ? core.floatLiteral(value) : core.intLiteral(value)
}

// Build a zero literal with the type matching the given type descriptor
function zeroOf(type) {
  return type.kind === "Float" ? core.floatLiteral(0) : core.intLiteral(0)
}

// True when both operands are the same variable object.
// The analyzer returns the *same* Variable object for every reference to a
// given variable, so reference equality (===) is safe here.
function sameVar(a, b) {
  return a.kind === "Variable" && b.kind === "Variable" && a === b
}

// ---------------------------------------------------------------------------
// Statement optimizers
// ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // Dead code elimination — constant conditions
  //
  // If the test folds to a literal bool we can throw away the dead branch
  // entirely. We return an _Inline marker so optimizeBlock() can splice the
  // surviving statements flat into the parent block without a wrapper node.
  // ---------------------------------------------------------------------------
  IfStatement(s) {
    const test = optimize(s.test)

    if (isBoolLit(test)) {
      const branch = test.value ? s.consequent : s.alternate
      return { kind: "_Inline", stmts: optimizeBlock(branch) }
    }

    return core.ifStmt(test, optimizeBlock(s.consequent), optimizeBlock(s.alternate))
  },

  // ---------------------------------------------------------------------------
  // Dead code elimination — `for false { }` (Go-style while)
  //
  // A loop whose condition is the literal `false` never executes.
  // Return null so optimizeBlock() drops it from the output.
  // A `for true { }` infinite loop is intentional and kept as-is.
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // Constant folding + algebraic simplification — binary expressions
  //
  // We always optimize both operands first (bottom-up) so that simplifications
  // in sub-expressions can bubble up and enable further folding here.
  // ---------------------------------------------------------------------------
  BinaryExpression(e) {
    const l = optimize(e.left)
    const r = optimize(e.right)

    // --- Constant folding ---
    // Both sides are numeric literals: compute the result now.
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

    // Bool == / != can also fold
    if (isBoolLit(l) && isBoolLit(r)) {
      if (e.operator === "==") return core.boolLiteral(l.value === r.value)
      if (e.operator === "!=") return core.boolLiteral(l.value !== r.value)
    }

    // --- Algebraic simplification ---
    // These identities hold regardless of whether the non-literal side has
    // side effects, because Salamis expressions are pure (no mutation).

    if (e.operator === "+") {
      if (isNumLit(r) && r.value === 0) return l  // x + 0 → x
      if (isNumLit(l) && l.value === 0) return r  // 0 + x → x
    }

    if (e.operator === "-") {
      if (isNumLit(r) && r.value === 0) return l  // x - 0 → x
      // x - x → 0 only for scalars: for Vecs we'd need a zero-vector of unknown
      // length, which can't be expressed as a single literal at compile time.
      if (sameVar(l, r) && !isVec(l)) return zeroOf(l.type)
    }

    if (e.operator === "*") {
      if (isNumLit(r) && r.value === 1) return l  // x * 1 → x
      if (isNumLit(l) && l.value === 1) return r  // 1 * x → x
      // x * 0 → 0 only for scalars: a Vec * 0 would need a zero-vector literal.
      if (isNumLit(r) && r.value === 0 && !isVec(l)) return numLit(0, r)
      if (isNumLit(l) && l.value === 0 && !isVec(r)) return numLit(0, l)
    }

    if (e.operator === "/") {
      if (isNumLit(r) && r.value === 1) return l  // x / 1 → x
    }

    return core.binaryExp(l, e.operator, r, e.type)
  },

  // ---------------------------------------------------------------------------
  // Constant folding — unary negation
  // neg(literal) → negate at compile time
  // ---------------------------------------------------------------------------
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
