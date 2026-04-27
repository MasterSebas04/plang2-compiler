import { describe, it } from "node:test"
import assert from "node:assert"
import parse from "../src/parser.js"
import analyze from "../src/analyzer.js"
import * as core from "../src/core.js"

const INT = { kind: "Int" }

const semanticChecks = [
  // Declarations
  ["Int variable declaration", "let x = 1\n"],
  ["Float variable declaration", "let x = 3.14\n"],
  ["Bool true declaration", "let x = true\n"],
  ["Bool false declaration", "let x = false\n"],
  ["Str declaration", 'let s = "hello"\n'],
  ["Vec declaration", "let v: Vec<Float> = [1.0, 2.0, 3.0]\n"],
  ["typed Int declaration", "let x: Int = 1\n"],
  ["typed Float declaration", "let x: Float = 3.14\n"],
  ["greek letter variable", "let μ: Float = 0.0\n"],
  ["sigma variable", "let σ: Float = 1.0\n"],

  // Reassignment
  ["Int reassignment", "let x = 1\nx = 2\n"],
  ["Bool reassignment", "let x = true\nx = false\n"],

  // Arithmetic
  ["Int addition", "let x = 1 + 2\n"],
  ["Int subtraction", "let x = 5 - 3\n"],
  ["Int multiplication", "let x = 2 * 3\n"],
  ["Int division", "let x = 6 / 2\n"],
  ["Float addition", "let x = 1.0 + 2.0\n"],
  ["Float multiplication", "let x = 2.0 * 3.0\n"],
  ["negation of Int", "let x = neg(5)\n"],
  ["negation of Float", "let x = neg(3.14)\n"],

  // Comparisons — all produce Bool
  ["less than", "let x = 1 < 2\n"],
  ["greater than", "let x = 2 > 1\n"],
  ["less than or equal", "let x = 1 <= 2\n"],
  ["greater than or equal", "let x = 2 >= 1\n"],
  ["equality", "let x = 1 == 1\n"],
  ["inequality", "let x = 1 != 2\n"],

  // Control flow
  ["if short with bool literal", "if true {\n}\n"],
  ["if-else with bool literal", "if true {\nlet x = 1\n} else {\nlet y = 2\n}\n"],
  ["if with comparison condition", "let x = 1\nif x < 2 {\nx = 2\n}\n"],
  ["for-condition loop with bool literal", "for false {\n}\n"],
  ["for-condition with comparison condition", "let x = 1\nfor x < 10 {\nx = 2\n}\n"],
  ["for range loop", "for i in (0..10) {\n}\n"],
  ["for range uses loop var as Int", "for i in (0..5) {\nlet x = i + 1\n}\n"],
  ["for collection loop", "let v: Vec<Int> = [1, 2, 3]\nfor x in (v) {\nlet y = x + 1\n}\n"],
  ["if-else-if chain", "let x = 1\nif x < 0 {\n} else if x == 0 {\n} else {\n}\n"],

  // Functions
  ["function with return type", "fn double(x: Int) ~> Int {\nreturn x\n}\n"],
  ["function without return type", "fn greet(name: Str) {\n}\n"],
  ["function call", "fn double(x: Int) ~> Int {\nreturn x\n}\nlet y = double(2)\n"],
  ["multi-param function", "fn add(a: Int, b: Int) ~> Int {\nreturn a\n}\n"],
  ["function call with multiple args", "fn add(a: Int, b: Int) ~> Int {\nreturn a\n}\nlet z = add(1, 2)\n"],
  ["function can see parent scope", "let x = 1\nfn f(a: Int) ~> Int {\nreturn x\n}\n"],
  ["function with Float param", "fn half(x: Float) ~> Float {\nreturn x\n}\n"],
  ["function with Bool param", "fn flipBool(x: Bool) ~> Bool {\nreturn x\n}\n"],

  // Pipe
  ["pipe into single-param function", "fn double(x: Int) ~> Int {\nreturn x\n}\nlet y = 1 |> double\n"],

  // Element-wise Vec operations
  ["Vec + Vec", "let v: Vec<Float> = [1.0, 2.0]\nlet w: Vec<Float> = [3.0, 4.0]\nlet r = v + w\n"],
  ["Vec - Vec", "let v: Vec<Float> = [1.0, 2.0]\nlet w: Vec<Float> = [3.0, 4.0]\nlet r = v - w\n"],
  ["Vec * Vec", "let v: Vec<Float> = [1.0, 2.0]\nlet w: Vec<Float> = [3.0, 4.0]\nlet r = v * w\n"],
  ["Vec / Vec", "let v: Vec<Float> = [1.0, 2.0]\nlet w: Vec<Float> = [3.0, 4.0]\nlet r = v / w\n"],
  ["Vec + Float broadcast", "let v: Vec<Float> = [1.0, 2.0]\nlet r = v + 1.0\n"],
  ["Vec - Float broadcast", "let v: Vec<Float> = [1.0, 2.0]\nlet r = v - 0.5\n"],
  ["Vec * Float broadcast", "let v: Vec<Float> = [1.0, 2.0]\nlet r = v * 2.0\n"],
  ["Vec / Float broadcast", "let v: Vec<Float> = [1.0, 2.0]\nlet r = v / 2.0\n"],
  ["Float * Vec broadcast", "let v: Vec<Float> = [1.0, 2.0]\nlet r = 2.0 * v\n"],
  ["neg on Vec", "let v: Vec<Float> = [1.0, 2.0]\nlet r = neg(v)\n"],

  // Multiple statements
  ["multiple declarations", "let x = 1\nlet y = 2\n"],
  ["variable used in for-condition body", "let x = 1\nfor false {\nx = 2\n}\n"],
  ["variable used in if body", "let x = 1\nif true {\nx = 2\n}\n"],
  ["chained comparisons", "let x = 3\nlet y = 5\nlet z = x < y\n"],

]

const semanticErrors = [
  // Scope
  ["use of undeclared variable", "let x = y\n", /Undefined variable/],
  ["assign to undeclared variable", "x = 1\n", /Undefined variable/],
  ["redeclaration of variable", "let x = 1\nlet x = 2\n", /Variable already declared/],
  ["redeclaration in for-condition body", "let x = 1\nfor true {\nlet x = 2\n}\n", /Variable already declared/],
  ["redeclaration in if body", "let x = 1\nif true {\nlet x = 2\n}\n", /Variable already declared/],
  ["undeclared variable in expression", "let x = y + 1\n", /Undefined variable/],
  ["undeclared variable in comparison", "let x = y < 1\n", /Undefined variable/],

  // Type mismatch in assignment
  ["assign Bool to Int variable", "let x = 1\nx = true\n", /Type mismatch/],
  ["assign Int to Bool variable", "let x = true\nx = 1\n", /Type mismatch/],
  ["assign Float to Int variable", "let x = 1\nx = 3.14\n", /Type mismatch/],
  ["type annotation mismatch", "let x: Int = 3.14\n", /Type mismatch/],

  // Non-bool conditions
  ["Int literal as if condition", "if 1 {\n}\n", /Expected Bool/],
  ["Int variable as if condition", "let x = 1\nif x {\n}\n", /Expected Bool/],
  ["Int literal as for-condition", "for 1 {\n}\n", /Expected Bool/],
  ["Int variable as for-condition", "let x = 1\nfor x {\n}\n", /Expected Bool/],

  // Vec type mismatches
  ["Vec<Float> + Vec<Int> rejected", "let v: Vec<Float> = [1.0]\nlet w: Vec<Int> = [1]\nlet r = v + w\n", /Vec type mismatch/],
  ["Vec<Float> + Int rejected (inner type mismatch)", "let v: Vec<Float> = [1.0]\nlet r = v + 1\n", /Cannot apply/],
  ["Bool + Vec rejected", "let v: Vec<Float> = [1.0]\nlet r = true + v\n", /Cannot apply/],

  // Non-numeric arithmetic
  ["Bool in addition left", "let x = true + 1\n", /Cannot apply/],
  ["Bool in addition right", "let x = 1 + true\n", /Cannot apply/],
  ["Bool in multiplication", "let x = true * 2\n", /Cannot apply/],
  ["Bool in subtraction", "let x = true - 1\n", /Cannot apply/],
  ["Bool in division", "let x = true / 1\n", /Cannot apply/],
  ["Bool in negation", "let x = neg(true)\n", /neg expects/],
  ["Bool in comparison", "let x = true < 1\n", /Expected Int or Float/],

  // Mixed types in arithmetic
  ["Float + Int mismatch", "let x = 1.0 + 1\n", /Type mismatch/],
  ["Int + Float mismatch", "let x = 1 + 1.0\n", /Type mismatch/],

  // Functions
  ["wrong number of arguments", "fn f(x: Int) ~> Int {\nreturn x\n}\nlet y = f(1, 2)\n", /Expected 1 arguments/],
  ["too few arguments", "fn add(a: Int, b: Int) ~> Int {\nreturn a\n}\nlet y = add(1)\n", /Expected 2 arguments/],
  ["wrong argument type", "fn f(x: Int) ~> Int {\nreturn x\n}\nlet y = f(true)\n", /Type mismatch/],
  ["return type mismatch", "fn f(x: Int) ~> Bool {\nreturn x\n}\n", /Type mismatch/],
  ["return outside function", "return 1\n", /Return outside of function/],
  ["call undeclared function", "let y = f(1)\n", /Undefined variable/],

  // Range
  ["Float in range start", "for i in (1.0..10) {\n}\n", /Type mismatch/],
  ["Float in range end", "for i in (0..10.0) {\n}\n", /Type mismatch/],
]

describe("The analyzer", () => {
  for (const [scenario, source] of semanticChecks) {
    it(`recognizes ${scenario}`, () => {
      assert.ok(analyze(parse(source)))
    })
  }
  for (const [scenario, source, errorPattern] of semanticErrors) {
    it(`throws on ${scenario}`, () => {
      assert.throws(() => analyze(parse(source)), errorPattern)
    })
  }
  it("produces the expected AST for a trivial program", () => {
    assert.deepEqual(
      analyze(parse("let x = 1\n")),
      core.program([
        core.letStmt(
          core.variable("x", INT),
          core.intLiteral(1)
        )
      ])
    )
  })
})
