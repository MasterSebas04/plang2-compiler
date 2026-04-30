import * as core from "./core.js"

class Context {
  constructor(parent = null, returnType = null) {
    this.parent = parent
    this.returnType = returnType ?? parent?.returnType ?? null
    this.bindings = new Map()
  }

  get(name, at) {
    if (this.bindings.has(name)) return this.bindings.get(name)
    if (this.parent) return this.parent.get(name, at)
    error(`Undefined variable: ${name}`, at)
  }

  set(name, value, at) {
    if (this.bindings.has(name)) error(`Variable already declared: ${name}`, at)
    this.bindings.set(name, value)
  }
}

function error(message, at) {
  throw new Error(`${at.getLineAndColumnMessage()}${message}`)
}

function validate(condition, message, at) {
  if (!condition) error(message, at)
}

// Type descriptors — plain objects compared by typesEqual()
const INT = { kind: "Int" }
const FLOAT = { kind: "Float" }
const BOOL = { kind: "Bool" }
const STR = { kind: "Str" }
const VOID = { kind: "Void" }

function vecType(inner) { return { kind: "Vec", inner } }
function matrixType(inner) { return { kind: "Matrix", inner } }
function distType(name, params) { return { kind: "Dist", name, params } }


function typesEqual(a, b) {
  if (a.kind !== b.kind) return false
  if (a.kind === "Vec" || a.kind === "Matrix") return typesEqual(a.inner, b.inner)
  if (a.kind === "Dist") return a.name === b.name && a.params.every((p, i) => typesEqual(p, b.params[i]))
  if (a.kind === "Fun") {
    return typesEqual(a.returnType, b.returnType) &&
      a.paramTypes.length === b.paramTypes.length &&
      a.paramTypes.every((p, i) => typesEqual(p, b.paramTypes[i]))
  }
  return true
}

function typeString(t) {
  if (t.kind === "Vec") return `Vec<${typeString(t.inner)}>`
  if (t.kind === "Matrix") return `Matrix<${typeString(t.inner)}>`
  if (t.kind === "Dist") return `${t.name}<${t.params.map(typeString).join(", ")}>`
  return t.kind
}

function isNumeric(t) { return t.kind === "Int" || t.kind === "Float" }

function validateType(actual, expected, at) {
  validate(
    typesEqual(actual, expected),
    `Type mismatch: expected ${typeString(expected)}, got ${typeString(actual)}`,
    at
  )
}

function validateNumeric(t, at) {
  validate(isNumeric(t), `Expected Int or Float, got ${typeString(t)}`, at)
}

function validateBool(t, at) {
  validate(typesEqual(t, BOOL), `Expected Bool, got ${typeString(t)}`, at)
}

function validateMatrix(t, at) {
  validate(t.kind === "Matrix", `Expected Matrix type, got ${typeString(t)}`, at)
}

// Determine the result type for arithmetic on numeric or Vec operands.
// Supports: scalar op scalar, Vec op Vec (element-wise), Vec op scalar (broadcast),
// and scalar op Vec (broadcast). Errors on any other combination.
function inferArithmeticType(lType, rType, op, at) {
  if (op === "+" && lType.kind === "Str" && rType.kind === "Str") return STR
  if (isNumeric(lType) && isNumeric(rType)) {
    validateType(rType, lType, at)
    return lType
  }
  if (lType.kind === "Vec" && rType.kind === "Vec") {
    validate(typesEqual(lType, rType),
      `Vec type mismatch for ${op}: ${typeString(lType)} vs ${typeString(rType)}`, at)
    return lType
  }
  // Vec<T> op T  →  Vec<T>
  if (lType.kind === "Vec" && typesEqual(rType, lType.inner)) return lType
  // T op Vec<T>  →  Vec<T>
  if (rType.kind === "Vec" && typesEqual(lType, rType.inner)) return rType
  error(`Cannot apply ${op} to ${typeString(lType)} and ${typeString(rType)}`, at)
}

function validateVecOrMatrix(t, at) {
  validate(
    t.kind === "Vec" || t.kind === "Matrix",
    `Expected Vec or Matrix, got ${typeString(t)}`,
    at
  )
}

export default function analyze(match) {
  let context = new Context()
  for (const [name, fun] of core.builtins) {
    context.set(name, fun, { getLineAndColumnMessage: () => "" })
  }

  const grammar = match.matcher.grammar

  const actions = {
    Program(statements) {
      return core.program(statements.children.map(s => s.analyze()).filter(s => s !== null))
    },

    Statement(s) {
      return s.analyze()
    },

    newline(_) {
      return null
    },

    VarDecl(_let, id, _colon, typeNode, _eq, exp, _newline) {
      const initializer = exp.analyze()
      let type = initializer.type ?? initializer
      if (typeNode.children.length > 0) {
        const declared = typeNode.children[0].analyze()
        validateType(type, declared, exp.source)
        type = declared
      }
      const v = core.variable(id.sourceString, type)
      context.set(id.sourceString, v, id.source)
      return core.letStmt(v, initializer)
    },

    AssignStmt(id, _eq, exp, _newline) {
      const target = context.get(id.sourceString, id.source)
      const source = exp.analyze()
      validateType(source.type ?? source, target.type, id.source)
      return core.assignStmt(target, source)
    },

    FunDecl(_fn, id, _open, params, _close, _arrow, returnTypeNode, block) {
      const paramList = params.asIteration().children.map(p => p.analyze())
      const declaredReturn = returnTypeNode.children.length > 0
        ? returnTypeNode.children[0].analyze()
        : VOID
      const fun = core.functionObject(id.sourceString, paramList, declaredReturn)
      context.set(id.sourceString, fun, id.source)
      const funContext = new Context(context, declaredReturn)
      for (const p of paramList) {
        funContext.set(p.name, p, id.source)
      }
      const previous = context
      context = funContext
      const body = block.analyze()
      context = previous
      return core.functionDecl(fun, body)
    },

    Param(id, _colon, type) {
      return core.param(id.sourceString, type.analyze())
    },

    Block(_open, _newline, statements, _close) {
      return statements.children.map(s => s.analyze()).filter(s => s !== null)
    },

    PrintStmt(_print, _open, exp, _close, _newline) {
      return core.printStmt(exp.analyze())
    },

    PlotStmt(_plot, _open, exps, _close, _newline) {
      const vals = exps.asIteration().children.map(e => {
        const val = e.analyze()
        const t = val.type ?? val
        validate(t.kind === "Vec", `plot expects a Vec, got ${typeString(t)}`, e.source)
        return val
      })
      return core.plotStmt(vals)
    },

    HistogramStmt(_histogram, _open, exp, _close, _newline) {
      const val = exp.analyze()
      const t = val.type ?? val
      validate(t.kind === "Vec", `histogram expects a Vec, got ${typeString(t)}`, exp.source)
      return core.histogramStmt(val)
    },

    ReturnStmt(_return, exp, _newline) {
      const value = exp.analyze()
      const valueType = value.type ?? value
      validate(context.returnType !== null, `Return outside of function`, _return.source)
      validateType(valueType, context.returnType, exp.source)
      return core.returnStmt(value)
    },

    IfStmt_elseif(_if, test, block, _else, alternate) {
      const t = test.analyze()
      validateBool(t.type ?? t, test.source)
      const consequent = block.analyze()
      const alt = alternate.analyze()
      return core.ifStmt(t, consequent, [alt])
    },

    IfStmt_long(_if, test, block1, _else, block2) {
      const t = test.analyze()
      validateBool(t.type ?? t, test.source)
      const consequent = block1.analyze()
      const alternate = block2.analyze()
      return core.ifStmt(t, consequent, alternate)
    },

    IfStmt_short(_if, test, block) {
      const t = test.analyze()
      validateBool(t.type ?? t, test.source)
      const consequent = block.analyze()
      return core.ifStmt(t, consequent, [])
    },

    ForStmt_range(_for, id, _in, _open, range, _close, block) {
      const r = range.analyze()
      const loopContext = new Context(context)
      const loopVar = core.variable(id.sourceString, INT)
      loopContext.set(id.sourceString, loopVar, id.source)
      const previous = context
      context = loopContext
      const body = block.analyze()
      context = previous
      return core.forRangeStmt(loopVar, r, body)
    },

    ForStmt_collection(_for, id, _in, _open, exp, _close, block) {
      const iter = exp.analyze()
      const iterType = iter.type ?? iter
      validateVecOrMatrix(iterType, exp.source)
      const elemType = iterType.inner
      const loopContext = new Context(context)
      const loopVar = core.variable(id.sourceString, elemType)
      loopContext.set(id.sourceString, loopVar, id.source)
      const previous = context
      context = loopContext
      const body = block.analyze()
      context = previous
      return core.forCollectionStmt(loopVar, iter, body)
    },

    ForStmt_while(_for, test, block) {
      const t = test.analyze()
      validateBool(t.type ?? t, test.source)
      const body = block.analyze()
      return core.whileStmt(t, body)
    },

    Range(from, _dotdot, to) {
      const f = from.analyze()
      const t = to.analyze()
      validateType(f.type ?? f, INT, from.source)
      validateType(t.type ?? t, INT, to.source)
      return core.rangeExp(f, t)
    },

    // --- Expressions ---

    Exp_pipe(left, _pipe, right) {
      const l = left.analyze()
      const r = right.analyze()
      const lType = l.type ?? l
      validate(
        r.kind === "FunctionObject" && r.params.length === 1 && typesEqual(r.params[0].type, lType),
        `Pipe type mismatch: cannot pipe ${typeString(lType)} into ${r.name ?? "expression"}`,
        _pipe.source
      )
      return core.pipeExp(l, r, r.returnType)
    },

    Exp1_compare(left, op, right) {
      const l = left.analyze()
      const r = right.analyze()
      const lType = l.type ?? l
      const rType = r.type ?? r
      validateNumeric(lType, left.source)
      validateType(rType, lType, right.source)
      return core.binaryExp(l, op.sourceString, r, BOOL)
    },

    Exp2_add(left, _op, right) {
      const l = left.analyze()
      const r = right.analyze()
      const type = inferArithmeticType(l.type ?? l, r.type ?? r, "+", left.source)
      return core.binaryExp(l, "+", r, type)
    },

    Exp2_sub(left, _op, right) {
      const l = left.analyze()
      const r = right.analyze()
      const type = inferArithmeticType(l.type ?? l, r.type ?? r, "-", left.source)
      return core.binaryExp(l, "-", r, type)
    },

    Exp3_mul(left, _op, right) {
      const l = left.analyze()
      const r = right.analyze()
      const type = inferArithmeticType(l.type ?? l, r.type ?? r, "*", left.source)
      return core.binaryExp(l, "*", r, type)
    },

    Exp3_div(left, _op, right) {
      const l = left.analyze()
      const r = right.analyze()
      const type = inferArithmeticType(l.type ?? l, r.type ?? r, "/", left.source)
      return core.binaryExp(l, "/", r, type)
    },

    Exp4_matmul(left, _op, right) {
      const l = left.analyze()
      const r = right.analyze()
      validateMatrix(l.type ?? l, left.source)
      validateMatrix(r.type ?? r, right.source)
      validateType(r.type ?? r, l.type ?? l, right.source)
      return core.matmulExp(l, r, l.type ?? l)
    },

    Exp5_negate(_neg, _open, exp, _close) {
      const x = exp.analyze()
      const t = x.type ?? x
      validate(
        isNumeric(t) || t.kind === "Vec",
        `neg expects a numeric or Vec, got ${typeString(t)}`,
        exp.source
      )
      return core.unaryExp("neg", x, t)
    },

    Exp5_slicerange(_slice, target, _open, range, _close) {
      const t = target.analyze()
      const tType = t.type ?? t
      validateVecOrMatrix(tType, target.source)
      range.analyze()
      return core.sliceExp(t, range.analyze(), tType)
    },

    Exp5_sliceindex(_slice, target, _open, index, _close) {
      const t = target.analyze()
      const tType = t.type ?? t
      validateVecOrMatrix(tType, target.source)
      const idx = index.analyze()
      validateType(idx.type ?? idx, INT, index.source)
      return core.sliceExp(t, idx, tType.inner)
    },

    Primary_vec(_open, elements, _close) {
      const items = elements.asIteration().children.map(e => e.analyze())
      if (items.length === 0) error("Empty vector literal", _open.source)
      const elemType = items[0].type ?? items[0]
      for (let i = 1; i < items.length; i++) {
        validateType(items[i].type ?? items[i], elemType, _open.source)
      }
      return core.vecLiteral(items, vecType(elemType))
    },

    Primary_simulate(_simulate, _open, count, _close, _lbrace, _nl1, body, _nl2, _rbrace) {
      const n = count.analyze()
      validateType(n.type ?? n, INT, count.source)
      const b = body.analyze()
      const bType = b.type ?? b
      validate(
        isNumeric(bType),
        `simulate body must return a numeric value, got ${typeString(bType)}`,
        body.source
      )
      return core.simulateExpr(n, b, core.VEC_FLOAT)
    },

    Primary_call(id, _open, args, _close) {
      // str(x) — converts any numeric or Bool value to Str
      if (id.sourceString === "str") {
        const argValues = args.asIteration().children.map(a => a.analyze())
        validate(argValues.length === 1, `str expects 1 argument`, id.source)
        const t = argValues[0].type ?? argValues[0]
        validate(
          isNumeric(t) || t.kind === "Bool",
          `str expects a numeric or Bool value, got ${typeString(t)}`,
          id.source
        )
        return core.functionCall({ kind: "FunctionObject", name: "str" }, argValues, STR)
      }
      // format(x, n) — formats a Float to n decimal places, returns Str
      if (id.sourceString === "format") {
        const argValues = args.asIteration().children.map(a => a.analyze())
        validate(argValues.length === 2, `format expects 2 arguments`, id.source)
        validateType(argValues[0].type ?? argValues[0], FLOAT, id.source)
        validateType(argValues[1].type ?? argValues[1], INT, id.source)
        return core.functionCall({ kind: "FunctionObject", name: "format" }, argValues, STR)
      }
      // sample(d) is a special form — accepts any distribution type, returns Float
      if (id.sourceString === "sample") {
        const argValues = args.asIteration().children.map(a => a.analyze())
        validate(argValues.length === 1, `sample expects 1 argument`, id.source)
        validate(
          (argValues[0].type ?? argValues[0]).kind === "Dist",
          `sample expects a distribution, got ${typeString(argValues[0].type ?? argValues[0])}`,
          id.source
        )
        return core.functionCall({ kind: "FunctionObject", name: "sample" }, argValues, FLOAT)
      }
      const fun = context.get(id.sourceString, id.source)
      validate(fun.kind === "FunctionObject", `${id.sourceString} is not a function`, id.source)
      const argValues = args.asIteration().children.map(a => a.analyze())
      validate(
        argValues.length === fun.params.length,
        `Expected ${fun.params.length} arguments, got ${argValues.length}`,
        id.source
      )
      for (let i = 0; i < argValues.length; i++) {
        validateType(argValues[i].type ?? argValues[i], fun.params[i].type, id.source)
      }
      return core.functionCall(fun, argValues, fun.returnType)
    },

    Primary_id(id) {
      return context.get(id.sourceString, id.source)
    },

    Primary_parens(_open, exp, _close) {
      return exp.analyze()
    },

    // --- Types ---

    Type_int(_) { return INT },
    Type_float(_) { return FLOAT },
    Type_bool(_) { return BOOL },
    Type_str(_) { return STR },
    Type_void(_) { return VOID },
    Type_vec(_vec, _open, inner, _close) { return vecType(inner.analyze()) },
    Type_matrix(_matrix, _open, inner, _close) { return matrixType(inner.analyze()) },
    Type_normal(_name, _open, t1, _comma, t2, _close) { return distType("Normal", [t1.analyze(), t2.analyze()]) },
    Type_bernoulli(_name, _open, t, _close) { return distType("Bernoulli", [t.analyze()]) },
    Type_poisson(_name, _open, t, _close) { return distType("Poisson", [t.analyze()]) },
    Type_uniform(_name, _open, t1, _comma, t2, _close) { return distType("Uniform", [t1.analyze(), t2.analyze()]) },

    // --- Literals ---

    floatnum(_int, _dot, _frac) {
      return core.floatLiteral(Number(this.sourceString))
    },

    num(_digits) {
      return core.intLiteral(Number(this.sourceString))
    },

    stringlit(_open, _chars, _close) {
      return core.strLiteral(this.sourceString.slice(1, -1))
    },

    true(_) { return core.boolLiteral(true) },
    false(_) { return core.boolLiteral(false) },
  }

  const semantics = grammar.createSemantics().addOperation("analyze", actions)
  return semantics(match).analyze()
}
