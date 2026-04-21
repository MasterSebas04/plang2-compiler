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
