import { describe, it } from "node:test"
import assert from "node:assert"
import parse from "../src/parser.js"

const syntaxChecks = [
  // Declarations
  ["let x = 1\n", "let without type annotation"],
  ["let x: Int = 1\n", "let with type annotation"],
  ["let μ: Float = 3.14\n", "greek letter variable"],
  ["let s: Str = \"hello\"\n", "string literal"],
  ["let v: Vec<Float> = [1.0, 2.0, 3.0]\n", "vector literal"],
  ["let b: Bool = true\n", "boolean true"],
  ["let b: Bool = false\n", "boolean false"],
  ["x = 1\n", "assignment statement"],

  // Functions
  ["fn add(a: Int, b: Int) ~> Int {\n}\n", "function with return type"],
  ["fn greet(name: Str) {\n}\n", "function without return type"],
  ["fn f(x: Float) ~> Float {\nreturn x\n}\n", "function with return statement"],

  // If statements
  ["if x {\n}\n", "if statement short"],
  ["if x {\n} else {\n}\n", "if-else statement"],
  ["if x {\n} else if y {\n}\n", "if-else-if statement"],
  ["if x == 1 {\nlet y = 2\n}\n", "if with comparison condition"],

  // Loops
  ["for x {\n}\n", "for-condition (Go-style while) statement"],
  ["for x < 10 {\n}\n", "for-condition with comparison"],
  ["for i in (0..10) {\n}\n", "for range loop"],
  ["for x in (data) {\n}\n", "for collection loop"],

  // Expressions
  ["let x = 1 + 2\n", "addition"],
  ["let x = 1 - 2\n", "subtraction"],
  ["let x = 2 * 3\n", "multiplication"],
  ["let x = 6 / 2\n", "division"],
  ["let x = a @ b\n", "matrix multiplication"],
  ["let x = a |> mean\n", "pipe expression"],
  ["let x = neg(5)\n", "negation"],
  ["let x = (1 + 2) * 3\n", "parenthesized expression"],
  ["let x = a <= b\n", "less than or equal"],
  ["let x = a >= b\n", "greater than or equal"],
  ["let x = a == b\n", "equality comparison"],
  ["let x = a != b\n", "inequality comparison"],

  // Slicing
  ["let x = slice data(0..1)\n", "slice variable by range"],
  ["let x = slice mean(data)(0..3)\n", "slice function result by range"],
  ["let x = slice mean(data)(0)\n", "slice function result by index"],

  // Function calls
  ["let x = mean(data)\n", "function call"],
  ["let x = f(a, b, c)\n", "function call with multiple args"],

  // Types
  ["let x: Vec<Int> = [1, 2, 3]\n", "vec type"],
  ["let x: Matrix<Float> = [[1.0]]\n", "matrix type"],
  ["let d: Normal<Float, Float> = Normal(0.0, 1.0)\n", "normal distribution type"],
  ["let d: Bernoulli<Float> = Bernoulli(0.5)\n", "bernoulli distribution type"],
  ["let d: Poisson<Float> = Poisson(λ)\n", "poisson distribution type"],
  ["let d: Uniform<Float, Float> = Uniform(0.0, 1.0)\n", "uniform distribution type"],

  // Misc
  ["", "empty program"],
  ["let x = 1\nlet y = 2\n", "multiple statements"],
  ["let σ: Float = 1.0\nlet μ: Float = 0.0\n", "multiple greek letter vars"],
]

const syntaxErrors = [
  // Declarations
  ["let x 1\n", "missing equals in let"],
  ["let = 1\n", "missing variable name in let"],
  ["let 1 = 2\n", "invalid variable name"],
  ["let if = 1\n", "'if' is not a variable name"],
  ["let for = 1\n", "'for' is not a variable name"],
  ["let true = 1\n", "'true' is not a variable name"],
  ["let false = 1\n", "'false' is not a variable name"],
  ["let fn = 1\n", "'fn' is not a variable name"],
  ["let neg = 1\n", "'neg' is not a variable name"],
  ["let slice = 1\n", "'slice' is not a variable name"],
  ["x =\n", "missing expression in assignment"],

  // Functions
  ["fn add(a, b) ~> Int {\n}\n", "parameter without type annotation"],
  ["fn (a: Int) {\n}\n", "missing function name"],

  // Blocks
  ["if x { }\n", "block missing newline after brace"],
  ["if x\n", "if missing block"],

  // Expressions
  ["let x = (1 + 2\n", "unclosed parenthesis"],
  ["let x = [1, 2, 3\n", "unclosed vector"],
  ["let x = \n", "missing expression"],

  // Keywords used as identifiers
  ["ifx {\n}\n", "'if' should be separated from identifier"],
  ["fnx(a: Int) {\n}\n", "'fn' should be separated from identifier"],
]

describe("parser", () => {
  for (const [input, scenario] of syntaxChecks) {
    it(`matches ${scenario}`, () => {
      assert.doesNotThrow(
        () => parse(input),
        `Expected to parse "${input}" successfully`,
      )
    })
  }
  for (const [input, scenario] of syntaxErrors) {
    it(`correctly detects the ${scenario} error`, () => {
      assert.throws(
        () => parse(input),
        `Expected parsing "${input}" to throw a syntax error`,
      )
    })
  }
})
