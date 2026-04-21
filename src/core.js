export function program(body) {
  return { kind: "Program", body }
}

export function variable(name, type) {
  return { kind: "Variable", name, type }
}

export function param(name, type) {
  return { kind: "Param", name, type }
}

export function functionDecl(fun, body) {
  return { kind: "FunctionDeclaration", function: fun, body }
}

export function functionObject(name, params, returnType) {
  return { kind: "FunctionObject", name, params, returnType }
}

export function functionCall(callee, args, type) {
  return { kind: "FunctionCall", callee, arguments: args, type }
}

export function letStmt(variable, initializer) {
  return { kind: "LetStatement", variable, initializer }
}

export function assignStmt(target, source) {
  return { kind: "AssignStatement", target, source }
}

export function returnStmt(exp) {
  return { kind: "ReturnStatement", exp }
}

export function ifStmt(test, consequent, alternate) {
  return { kind: "IfStatement", test, consequent, alternate }
}

export function whileStmt(test, body) {
  return { kind: "WhileStatement", test, body }
}

export function forRangeStmt(id, range, body) {
  return { kind: "ForRangeStatement", id, range, body }
}

export function forCollectionStmt(id, iter, body) {
  return { kind: "ForCollectionStatement", id, iter, body }
}

export function rangeExp(from, to) {
  return { kind: "RangeExpression", from, to }
}

export function binaryExp(left, operator, right, type) {
  return { kind: "BinaryExpression", operator, left, right, type }
}

export function unaryExp(operator, argument, type) {
  return { kind: "UnaryExpression", operator, argument, type }
}

export function pipeExp(left, right, type) {
  return { kind: "PipeExpression", left, right, type }
}

export function matmulExp(left, right, type) {
  return { kind: "MatmulExpression", left, right, type }
}

export function sliceExp(target, index, type) {
  return { kind: "SliceExpression", target, index, type }
}

export function distributionType(name, typeArgs) {
  return { kind: "DistributionType", name, typeArgs }
}

export function vecLiteral(elements, type) {
  return { kind: "VecLiteral", elements, type }
}

export function intLiteral(value) {
  return { kind: "IntLiteral", value, type: { kind: "Int" } }
}

export function floatLiteral(value) {
  return { kind: "FloatLiteral", value, type: { kind: "Float" } }
}

export function boolLiteral(value) {
  return { kind: "BoolLiteral", value, type: { kind: "Bool" } }
}

export function strLiteral(value) {
  return { kind: "StrLiteral", value, type: { kind: "Str" } }
}

export function printStmt(exp) {
  return { kind: "PrintStatement", exp }
}

export function plotStmt(exp) {
  return { kind: "PlotStatement", exp }
}

// Type descriptors exported for use in builtins and tests
export const INT   = { kind: "Int" }
export const FLOAT = { kind: "Float" }
export const BOOL  = { kind: "Bool" }
export const STR   = { kind: "Str" }
export const VOID  = { kind: "Void" }
export const VEC_FLOAT = { kind: "Vec", inner: FLOAT }
export const VEC_INT   = { kind: "Vec", inner: INT }

// Distribution type descriptors
export function distType(name, params) { return { kind: "Dist", name, params } }
export const DIST_NORMAL    = distType("Normal",    [FLOAT, FLOAT])
export const DIST_BERNOULLI = distType("Bernoulli", [FLOAT])
export const DIST_POISSON   = distType("Poisson",   [FLOAT])
export const DIST_UNIFORM   = distType("Uniform",   [FLOAT, FLOAT])

// Built-in function objects — single source of truth for analyzer + generator
export const builtins = new Map([
  // Math
  ["sqrt",     functionObject("sqrt",     [param("x", FLOAT)], FLOAT)],
  ["log",      functionObject("log",      [param("x", FLOAT)], FLOAT)],
  ["log2",     functionObject("log2",     [param("x", FLOAT)], FLOAT)],
  ["log10",    functionObject("log10",    [param("x", FLOAT)], FLOAT)],
  ["abs",      functionObject("abs",      [param("x", FLOAT)], FLOAT)],
  ["exp",      functionObject("exp",      [param("x", FLOAT)], FLOAT)],
  ["floor",    functionObject("floor",    [param("x", FLOAT)], INT)],
  ["ceil",     functionObject("ceil",     [param("x", FLOAT)], INT)],
  ["round",    functionObject("round",    [param("x", FLOAT)], INT)],
  ["sin",      functionObject("sin",      [param("x", FLOAT)], FLOAT)],
  ["cos",      functionObject("cos",      [param("x", FLOAT)], FLOAT)],
  ["pow",      functionObject("pow",      [param("base", FLOAT), param("exp", FLOAT)], FLOAT)],
  // Vec
  ["len",      functionObject("len",      [param("v", VEC_FLOAT)], INT)],
  ["sum",      functionObject("sum",      [param("v", VEC_FLOAT)], FLOAT)],
  ["mean",     functionObject("mean",     [param("v", VEC_FLOAT)], FLOAT)],
  ["max",      functionObject("max",      [param("v", VEC_FLOAT)], FLOAT)],
  ["min",      functionObject("min",      [param("v", VEC_FLOAT)], FLOAT)],
  // Distribution constructors
  ["Normal",    functionObject("Normal",    [param("mu", FLOAT), param("sigma", FLOAT)], DIST_NORMAL)],
  ["Bernoulli", functionObject("Bernoulli", [param("p", FLOAT)],                         DIST_BERNOULLI)],
  ["Poisson",   functionObject("Poisson",   [param("lambda", FLOAT)],                    DIST_POISSON)],
  ["Uniform",   functionObject("Uniform",   [param("a", FLOAT), param("b", FLOAT)],      DIST_UNIFORM)],
])
